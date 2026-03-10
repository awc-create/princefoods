// src/app/api/admin/promotions/route.ts
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

type EligibleCustomerScope = 'ALL' | 'USERS';
type ApplyMode = 'AUTO' | 'CODE' | 'HYBRID';

async function hasAllowedUsersTable(): Promise<boolean> {
  // Postgres-only. Safe + fast.
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT to_regclass('public."PromotionAllowedUser"') IS NOT NULL AS "exists"
    `;
    return !!rows?.[0]?.exists;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role: Role | undefined = hasRole(session?.user)
      ? (session!.user.role ?? undefined)
      : undefined;

    if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

    const allowedUsersTableExists = await hasAllowedUsersTable();

    // IMPORTANT:
    // Do NOT request `_count.allowedUsers` if the table doesn't exist,
    // otherwise Prisma will throw P2021 and the whole endpoint fails.
    const promos = await prisma.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        status: true,
        applyMode: true,

        eligibleCustomerScope: true,

        discountType: true,
        percentOff: true,
        amountOffPence: true,

        applyShippingDiscount: true,
        shippingPercentOffDry: true,
        shippingPercentOffFrozen: true,

        targetType: true,

        startsAt: true,
        endsAt: true,
        maxUsesTotal: true,
        maxUsesPerUser: true,

        createdAt: true,
        updatedAt: true,

        _count: { select: { redemptions: true } }
      }
    });

    // If table exists, hydrate eligibleUserIdsCount via raw SQL.
    // (This avoids Prisma touching a missing table.)
    let allowedCountByPromoId = new Map<string, number>();
    if (allowedUsersTableExists) {
      const rows = await prisma.$queryRaw<Array<{ promotionId: string; c: bigint }>>`
        SELECT "promotionId", COUNT(*)::bigint AS c
        FROM "PromotionAllowedUser"
        GROUP BY "promotionId"
      `;
      allowedCountByPromoId = new Map(rows.map((r) => [r.promotionId, Number(r.c)]));
    }

    return NextResponse.json({
      ok: true,
      promotions: promos.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code, // null allowed for AUTO
        type: p.type,
        status: p.status,
        applyMode: (p.applyMode ?? 'CODE') as ApplyMode,

        eligibleCustomerScope: p.eligibleCustomerScope as EligibleCustomerScope,
        eligibleUserIdsCount: allowedUsersTableExists ? (allowedCountByPromoId.get(p.id) ?? 0) : 0,

        discountType: p.discountType,
        percentOff: p.percentOff,
        amountOffPence: p.amountOffPence,

        applyShippingDiscount: p.applyShippingDiscount,
        shippingPercentOffDry: p.shippingPercentOffDry,
        shippingPercentOffFrozen: p.shippingPercentOffFrozen,

        targetType: p.targetType,

        startsAt: p.startsAt ? p.startsAt.toISOString() : null,
        endsAt: p.endsAt ? p.endsAt.toISOString() : null,
        maxUsesTotal: p.maxUsesTotal,
        maxUsesPerUser: p.maxUsesPerUser,

        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),

        redemptionCount: p._count.redemptions
      }))
    });
  } catch (e) {
    console.error('[GET /api/admin/promotions] error', e);
    return NextResponse.json({ ok: false, error: 'Failed to load promotions' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const role: Role | undefined = hasRole(session?.user)
      ? (session!.user.role ?? undefined)
      : undefined;

    if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

    const body = (await req.json().catch(() => null)) as null | {
      name?: string;

      // allow null/empty for AUTO
      code?: string | null;

      type?: 'CODE' | 'GIFT';
      status?: 'ACTIVE' | 'PAUSED' | 'EXPIRED';

      // ✅ new (align with schema)
      applyMode?: ApplyMode;

      startsAt?: string | null;
      endsAt?: string | null;

      lockedToUserId?: string | null;
      lockedToEmail?: string | null;

      maxUsesTotal?: number | null;
      maxUsesPerUser?: number | null;

      discountType?: 'PERCENT' | 'AMOUNT' | 'PRODUCT_100';
      percentOff?: number | null;
      amountOffPence?: number | null;

      applyShippingDiscount?: boolean;
      shippingPercentOffDry?: number | null;
      shippingPercentOffFrozen?: number | null;

      targetType?: 'SITE_WIDE' | 'CATEGORIES' | 'PRODUCTS';
      categoryIds?: string[];
      productIds?: string[];

      eligibleCustomerScope?: EligibleCustomerScope;
      eligibleUserIds?: string[];
    };

    if (!body) {
      return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
    }

    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
    }

    const promoType = body.type ?? 'CODE';
    const applyMode: ApplyMode = body.applyMode ?? 'CODE';

    // code is optional for AUTO
    const rawCode = typeof body.code === 'string' ? body.code : '';
    const code = rawCode ? normCode(rawCode) : '';

    // enforce code only when it's needed
    const codeRequired = promoType === 'CODE' && (applyMode === 'CODE' || applyMode === 'HYBRID');
    if (codeRequired && !code) {
      return NextResponse.json({ ok: false, error: 'Code is required.' }, { status: 400 });
    }

    const discountType = body.discountType ?? 'PERCENT';
    const percentOff = asIntOrNull(body.percentOff);
    const amountOffPence = asIntOrNull(body.amountOffPence);

    if (discountType === 'PERCENT') {
      const pct = clampPct(percentOff ?? 0);
      if (pct < 1) {
        return NextResponse.json(
          { ok: false, error: 'percentOff must be 1–100 for PERCENT.' },
          { status: 400 }
        );
      }
    }

    if (discountType === 'AMOUNT') {
      const amt = Math.max(0, amountOffPence ?? 0);
      if (amt < 1) {
        return NextResponse.json(
          { ok: false, error: 'amountOffPence must be > 0 for AMOUNT.' },
          { status: 400 }
        );
      }
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (startsAt && endsAt && endsAt < startsAt) {
      return NextResponse.json(
        { ok: false, error: 'endsAt must be after startsAt.' },
        { status: 400 }
      );
    }

    const targetType = body.targetType ?? 'SITE_WIDE';
    const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds : [];
    const productIds = Array.isArray(body.productIds) ? body.productIds : [];

    if (targetType === 'CATEGORIES' && categoryIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Select at least 1 category for CATEGORIES target.' },
        { status: 400 }
      );
    }
    if (targetType === 'PRODUCTS' && productIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Select at least 1 product for PRODUCTS target.' },
        { status: 400 }
      );
    }

    const applyShippingDiscount = body.applyShippingDiscount === true;
    const shipDry =
      body.shippingPercentOffDry == null ? null : clampPct(body.shippingPercentOffDry);
    const shipFrozen =
      body.shippingPercentOffFrozen == null ? null : clampPct(body.shippingPercentOffFrozen);

    const eligibleCustomerScope: EligibleCustomerScope = body.eligibleCustomerScope ?? 'ALL';
    const eligibleUserIds = Array.isArray(body.eligibleUserIds) ? body.eligibleUserIds : [];

    if (eligibleCustomerScope === 'USERS' && eligibleUserIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Select at least 1 eligible user when mode is USERS.' },
        { status: 400 }
      );
    }

    const allowedUsersTableExists = await hasAllowedUsersTable();
    if (eligibleCustomerScope === 'USERS' && !allowedUsersTableExists) {
      // Don’t silently create a broken promo.
      return NextResponse.json(
        { ok: false, error: 'Allow-list table is missing (PromotionAllowedUser).' },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const promo = await tx.promotion.create({
        data: {
          name,

          // if code is empty => store null
          code: code || undefined,

          type: promoType,
          status: body.status ?? 'ACTIVE',
          applyMode,

          startsAt: startsAt ?? undefined,
          endsAt: endsAt ?? undefined,

          lockedToUserId: body.lockedToUserId ?? undefined,
          lockedToEmail: (body.lockedToEmail ?? '').trim() || undefined,

          maxUsesTotal: body.maxUsesTotal ?? undefined,
          maxUsesPerUser: body.maxUsesPerUser ?? undefined,

          discountType,
          percentOff: discountType === 'PERCENT' ? clampPct(percentOff ?? 0) : undefined,
          amountOffPence: discountType === 'AMOUNT' ? Math.max(0, amountOffPence ?? 0) : undefined,

          applyShippingDiscount,
          shippingPercentOffDry: applyShippingDiscount ? (shipDry ?? undefined) : undefined,
          shippingPercentOffFrozen: applyShippingDiscount ? (shipFrozen ?? undefined) : undefined,

          targetType,

          eligibleCustomerScope
        }
      });

      if (targetType === 'CATEGORIES' && categoryIds.length) {
        await tx.promotionCategory.createMany({
          data: categoryIds.map((categoryId) => ({ promotionId: promo.id, categoryId })),
          skipDuplicates: true
        });
      }

      if (targetType === 'PRODUCTS' && productIds.length) {
        await tx.promotionProduct.createMany({
          data: productIds.map((productId) => ({ promotionId: promo.id, productId })),
          skipDuplicates: true
        });
      }

      if (eligibleCustomerScope === 'USERS' && allowedUsersTableExists) {
        await tx.promotionAllowedUser.createMany({
          data: eligibleUserIds.map((userId) => ({ promotionId: promo.id, userId })),
          skipDuplicates: true
        });
      }

      return promo;
    });

    return NextResponse.json({ ok: true, promotion: created });
  } catch (e) {
    console.error('[POST /api/admin/promotions] error', e);
    return NextResponse.json({ ok: false, error: 'Failed to create promotion' }, { status: 500 });
  }
}
