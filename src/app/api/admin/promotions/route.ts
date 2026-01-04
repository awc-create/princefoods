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

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const promos = await prisma.promotion.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      code: true,
      type: true,
      status: true,

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

  return NextResponse.json({
    ok: true,
    promotions: promos.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      type: p.type,
      status: p.status,

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
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const body = (await req.json()) as {
    name?: string;
    code?: string;
    type?: 'CODE' | 'GIFT';
    status?: 'ACTIVE' | 'PAUSED' | 'EXPIRED';
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
  };

  const name = (body.name ?? '').trim();
  const code = normCode(body.code ?? '');

  if (!name) return NextResponse.json({ ok: false, error: 'Name is required.' }, { status: 400 });
  if (!code) return NextResponse.json({ ok: false, error: 'Code is required.' }, { status: 400 });

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
  const shipDry = body.shippingPercentOffDry == null ? null : clampPct(body.shippingPercentOffDry);
  const shipFrozen =
    body.shippingPercentOffFrozen == null ? null : clampPct(body.shippingPercentOffFrozen);

  const created = await prisma.$transaction(async (tx) => {
    const promo = await tx.promotion.create({
      data: {
        name,
        code,
        type: body.type ?? 'CODE',
        status: body.status ?? 'ACTIVE',

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

        targetType
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

    return promo;
  });

  return NextResponse.json({ ok: true, promotion: created });
}
