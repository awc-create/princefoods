import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { id } = await ctx.params;

  const promo = await prisma.promotion.findUnique({
    where: { id },
    include: {
      categories: { select: { categoryId: true } },
      products: { select: { productId: true } },
      _count: { select: { redemptions: true } }
    }
  });

  if (!promo) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json({
    ok: true,
    promotion: {
      ...promo,
      startsAt: promo.startsAt ? promo.startsAt.toISOString() : null,
      endsAt: promo.endsAt ? promo.endsAt.toISOString() : null,
      createdAt: promo.createdAt.toISOString(),
      updatedAt: promo.updatedAt.toISOString(),
      redemptionCount: promo._count.redemptions
    }
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { id } = await ctx.params;

  const existing = await prisma.promotion.findUnique({
    where: { id },
    select: { id: true, endsAt: true }
  });
  if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | null
    | { action: 'pause' | 'resume' }
    | Partial<{
        name: string;
        code: string;
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
      }>;

  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  // ✅ action mode
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
  if (typeof body.code === 'string') data.code = normCode(body.code);
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
  if ('amountOffPence' in body)
    data.amountOffPence =
      body.amountOffPence == null ? null : Math.max(0, asIntOrNull(body.amountOffPence) ?? 0);

  if ('applyShippingDiscount' in body) data.applyShippingDiscount = !!body.applyShippingDiscount;
  if ('shippingPercentOffDry' in body)
    data.shippingPercentOffDry =
      body.shippingPercentOffDry == null ? null : clampPct(body.shippingPercentOffDry);
  if ('shippingPercentOffFrozen' in body)
    data.shippingPercentOffFrozen =
      body.shippingPercentOffFrozen == null ? null : clampPct(body.shippingPercentOffFrozen);

  if (typeof body.targetType === 'string') data.targetType = body.targetType;

  const categoryIds =
    'categoryIds' in body && Array.isArray(body.categoryIds) ? body.categoryIds : null;

  const productIds =
    'productIds' in body && Array.isArray(body.productIds) ? body.productIds : null;

  const updated = await prisma.$transaction(async (tx) => {
    const promo = await tx.promotion.update({ where: { id }, data });

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

    return promo;
  });

  return NextResponse.json({ ok: true, promotion: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { id } = await ctx.params;

  await prisma.$transaction(async (tx) => {
    await tx.promotionCategory.deleteMany({ where: { promotionId: id } });
    await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
    await tx.promotion.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
