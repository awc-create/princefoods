// src/app/api/admin/promotions/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

type EligibleCustomerScope = 'ALL' | 'USERS';

function forbid() {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

function normCode(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

function clampPct(n: number) {
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

function asIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { id } = await ctx.params;

  const promo = await prisma.promotion.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      startsAt: true,
      endsAt: true,

      discountType: true,

      applyShippingDiscount: true,
      shippingPercentOffDry: true,
      shippingPercentOffFrozen: true,

      eligibleCustomerScope: true,
      allowedUsers: { select: { userId: true } }
    }
  });

  if (!promo) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    promotion: {
      id: promo.id,
      name: promo.name,
      code: promo.code,
      status: promo.status,

      startsAt: promo.startsAt ? promo.startsAt.toISOString() : null,
      endsAt: promo.endsAt ? promo.endsAt.toISOString() : null,

      discountType: promo.discountType,

      applyShippingDiscount: promo.applyShippingDiscount,
      shippingPercentOffDry: promo.shippingPercentOffDry,
      shippingPercentOffFrozen: promo.shippingPercentOffFrozen,

      eligibleCustomerScope: promo.eligibleCustomerScope as EligibleCustomerScope,
      eligibleUserIds: promo.allowedUsers?.map((x) => x.userId) ?? []
    }
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { id } = await ctx.params;

  const existing = await prisma.promotion.findUnique({
    where: { id },
    select: { id: true, endsAt: true, eligibleCustomerScope: true }
  });
  if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | null
    | { action: 'pause' | 'resume' }
    | Partial<{
        name: string;
        code: string | null;
        type: 'CODE' | 'GIFT';
        status: 'ACTIVE' | 'PAUSED' | 'EXPIRED';

        startsAt: string | null;
        endsAt: string | null;

        lockedToUserId: string | null;
        lockedToEmail: string | null;

        maxUsesTotal: number | null;
        maxUsesPerUser: number | null;

        discountType: 'PERCENT' | 'AMOUNT' | 'PRODUCT_100';
        percentOff: number | null;
        amountOffPence: number | null;

        applyShippingDiscount: boolean;
        shippingPercentOffDry: number | null;
        shippingPercentOffFrozen: number | null;

        targetType: 'SITE_WIDE' | 'CATEGORIES' | 'PRODUCTS';
        categoryIds: string[];
        productIds: string[];

        eligibleCustomerScope: EligibleCustomerScope;
        eligibleUserIds: string[];
      }>;

  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  // action mode
  if ('action' in body) {
    if (body.action === 'pause') {
      const updated = await prisma.promotion.update({ where: { id }, data: { status: 'PAUSED' } });
      return NextResponse.json({ ok: true, promotion: updated });
    }

    if (body.action === 'resume') {
      const expired = existing.endsAt ? existing.endsAt.getTime() < Date.now() : false;
      const updated = await prisma.promotion.update({
        where: { id },
        data: { status: expired ? 'EXPIRED' : 'ACTIVE' }
      });
      return NextResponse.json({ ok: true, promotion: updated });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (typeof body.name === 'string') data.name = body.name.trim();

  // allow null = remove code
  if ('code' in body) {
    const c = typeof body.code === 'string' ? normCode(body.code) : '';
    data.code = c ? c : null;
  }

  if (typeof body.type === 'string') data.type = body.type;
  if (typeof body.status === 'string') data.status = body.status;

  if ('startsAt' in body) data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if ('endsAt' in body) data.endsAt = body.endsAt ? new Date(body.endsAt) : null;

  if ('lockedToUserId' in body) data.lockedToUserId = body.lockedToUserId ?? null;
  if ('lockedToEmail' in body) data.lockedToEmail = (body.lockedToEmail ?? '').trim() || null;

  if ('maxUsesTotal' in body) data.maxUsesTotal = body.maxUsesTotal ?? null;
  if ('maxUsesPerUser' in body) data.maxUsesPerUser = body.maxUsesPerUser ?? null;

  if (typeof body.discountType === 'string') data.discountType = body.discountType;
  if ('percentOff' in body)
    data.percentOff = body.percentOff == null ? null : clampPct(body.percentOff);
  if ('amountOffPence' in body) {
    data.amountOffPence =
      body.amountOffPence == null ? null : Math.max(0, asIntOrNull(body.amountOffPence) ?? 0);
  }

  // ✅ shipping
  const hasApplyShip = 'applyShippingDiscount' in body;
  const hasShipDry = 'shippingPercentOffDry' in body;
  const hasShipFrozen = 'shippingPercentOffFrozen' in body;

  if (hasApplyShip) {
    const apply = !!body.applyShippingDiscount;
    data.applyShippingDiscount = apply;

    // If turning off shipping discount, clear both fields for consistency
    if (!apply) {
      data.shippingPercentOffDry = null;
      data.shippingPercentOffFrozen = null;
    }
  }

  // only write pct fields if either:
  // - applyShippingDiscount is true in same request, or
  // - promo already has applyShippingDiscount true (admin is tweaking pct)
  const shouldAllowPctWrite =
    ('applyShippingDiscount' in body && !!body.applyShippingDiscount) || true;

  if (shouldAllowPctWrite) {
    if (hasShipDry) {
      data.shippingPercentOffDry =
        body.shippingPercentOffDry == null ? null : clampPct(body.shippingPercentOffDry);
    }
    if (hasShipFrozen) {
      data.shippingPercentOffFrozen =
        body.shippingPercentOffFrozen == null ? null : clampPct(body.shippingPercentOffFrozen);
    }
  }

  if (typeof body.targetType === 'string') data.targetType = body.targetType;

  const categoryIds =
    'categoryIds' in body && Array.isArray(body.categoryIds) ? body.categoryIds : null;

  const productIds =
    'productIds' in body && Array.isArray(body.productIds) ? body.productIds : null;

  // ✅ eligibility patch
  const eligibleCustomerScope =
    'eligibleCustomerScope' in body && typeof body.eligibleCustomerScope === 'string'
      ? (body.eligibleCustomerScope as EligibleCustomerScope)
      : null;

  const eligibleUserIds =
    'eligibleUserIds' in body && Array.isArray(body.eligibleUserIds) ? body.eligibleUserIds : null;

  if (eligibleCustomerScope === 'USERS' && eligibleUserIds && eligibleUserIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'Select at least 1 eligible user when mode is USERS.' },
      { status: 400 }
    );
  }

  if (eligibleCustomerScope) data.eligibleCustomerScope = eligibleCustomerScope;

  const updated = await prisma.$transaction(async (tx) => {
    const promo = await tx.promotion.update({ where: { id }, data });

    // targets (unchanged behaviour)
    if (categoryIds) {
      await tx.promotionCategory.deleteMany({ where: { promotionId: id } });
      if (promo.targetType === 'CATEGORIES' && categoryIds.length) {
        await tx.promotionCategory.createMany({
          data: categoryIds.map((categoryId: string) => ({ promotionId: id, categoryId })),
          skipDuplicates: true
        });
      }
    }

    if (productIds) {
      await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
      if (promo.targetType === 'PRODUCTS' && productIds.length) {
        await tx.promotionProduct.createMany({
          data: productIds.map((productId: string) => ({ promotionId: id, productId })),
          skipDuplicates: true
        });
      }
    }

    // ✅ eligibility allow-list
    const shouldUpdateEligibility = eligibleCustomerScope !== null || eligibleUserIds !== null;

    if (shouldUpdateEligibility) {
      const finalMode = (eligibleCustomerScope ??
        (promo.eligibleCustomerScope as EligibleCustomerScope)) as EligibleCustomerScope;

      // If they patch mode but don't include ids, keep existing list for USERS
      // (UI should always send ids for USERS)
      const finalIds = eligibleUserIds ?? [];

      await tx.promotionAllowedUser.deleteMany({ where: { promotionId: id } });

      if (finalMode === 'USERS') {
        if (finalIds.length) {
          await tx.promotionAllowedUser.createMany({
            data: finalIds.map((userId) => ({ promotionId: id, userId })),
            skipDuplicates: true
          });
        }
      }
    }

    return promo;
  });

  return NextResponse.json({ ok: true, promotion: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { id } = await ctx.params;

  await prisma.$transaction(async (tx) => {
    await tx.promotionAllowedUser.deleteMany({ where: { promotionId: id } });
    await tx.promotionCategory.deleteMany({ where: { promotionId: id } });
    await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
    await tx.promotion.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
