// src/app/api/promotions/evaluate/route.ts
import { prisma } from '@/lib/prisma';
import { promoLimiter } from '@/lib/rate-limit';
import { getClientIp, tooManyRequests } from '@/lib/rate-limit-response';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ShippingKind = 'DRY' | 'FROZEN' | 'MIXED';

interface EvalItem {
  productId?: string | null;
  sku?: string | null;
  unitPrice: number; // pence
  quantity: number;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function isNonNegInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 0;
}

function isPosInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

function clampPct(n: number) {
  const x = Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.max(0, Math.min(100, x));
}

function normalizeCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function subtotalFor(items: EvalItem[]) {
  return items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
}

async function logAttempt(args: {
  checkoutId?: string | null;
  code: string;
  promotionId?: string | null;
  userId?: string | null;
  email?: string | null;
  outcome: 'EVAL_OK' | 'EVAL_ERR';
  errorCode?: string | null;
  currency: string;
  subtotalPence?: number | null;
  shippingPence?: number | null;
  discountPence?: number;
  shippingDiscountPence?: number;
}) {
  try {
    await prisma.promotionAttempt.create({
      data: {
        checkoutId: args.checkoutId ?? null,
        code: args.code,
        promotionId: args.promotionId ?? null,
        userId: args.userId ?? null,
        email: args.email ?? null,
        outcome: args.outcome,
        errorCode: args.errorCode ?? null,
        currency: args.currency,
        subtotalPence: args.subtotalPence ?? null,
        shippingPence: args.shippingPence ?? null,
        discountPence: Math.max(0, Math.trunc(args.discountPence ?? 0)),
        shippingDiscountPence: Math.max(0, Math.trunc(args.shippingDiscountPence ?? 0))
      }
    });
  } catch {
    // ignore
  }
}

export async function POST(req: Request) {
  const rl = promoLimiter(getClientIp(req));
  if (!rl.allowed) return tooManyRequests(rl);

  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || typeof body !== 'object') return bad('BAD_REQUEST');

  const { code, items, userId, email, shippingPence, currency, shippingKind, checkoutId } =
    body as {
      code?: string;
      items?: EvalItem[];
      userId?: string | null;
      email?: string | null;
      shippingPence?: number;
      currency?: string;
      shippingKind?: ShippingKind;
      checkoutId?: string | null;
    };

  const cur =
    typeof currency === 'string' && currency.trim() ? currency.trim().toUpperCase() : 'GBP';

  if (!Array.isArray(items) || items.length === 0) return bad('NO_ITEMS');

  for (const it of items) {
    if (!isNonNegInt(it.unitPrice)) return bad('BAD_ITEM_PRICE');
    if (!isPosInt(it.quantity)) return bad('BAD_ITEM_QTY');
  }

  const sub = subtotalFor(items);
  const ship = isNonNegInt(shippingPence) ? shippingPence : 0;
  const kind: ShippingKind = shippingKind ?? 'DRY';
  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';

  const hasCode = typeof code === 'string' && code.trim().length > 0;

  // ============================================
  // 🔥 AUTO PROMOTION MODE
  // ============================================

  if (!hasCode) {
    if (!userId) {
      return NextResponse.json({ ok: true, auto: false });
    }

    const now = new Date();

    const promos = await prisma.promotion.findMany({
      where: {
        code: null,
        status: 'ACTIVE',
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }]
      },
      select: {
        id: true,
        name: true,
        discountType: true,
        percentOff: true,
        amountOffPence: true,
        applyShippingDiscount: true,
        shippingPercentOffDry: true,
        shippingPercentOffFrozen: true,
        eligibleCustomerScope: true,
        allowedUsers: {
          where: { userId },
          select: { userId: true }
        }
      }
    });

    const eligible = promos.filter((p) => {
      if (p.eligibleCustomerScope === 'ALL') return true;
      return p.allowedUsers.length > 0;
    });

    if (!eligible.length) {
      return NextResponse.json({ ok: true, auto: false });
    }

    const best = eligible.sort((a, b) => {
      const aVal = a.percentOff ?? a.amountOffPence ?? 0;
      const bVal = b.percentOff ?? b.amountOffPence ?? 0;
      return bVal - aVal;
    })[0];

    let discountPence = 0;

    if (best.discountType === 'PERCENT') {
      discountPence = Math.round((sub * clampPct(best.percentOff ?? 0)) / 100);
    } else if (best.discountType === 'AMOUNT') {
      discountPence = Math.min(sub, best.amountOffPence ?? 0);
    }

    let shippingDiscountPence = 0;
    if (best.applyShippingDiscount) {
      const pctDry = clampPct(best.shippingPercentOffDry ?? 0);
      const pctFrozen = clampPct(best.shippingPercentOffFrozen ?? 0);
      const pct =
        kind === 'FROZEN' ? pctFrozen : kind === 'DRY' ? pctDry : Math.max(pctDry, pctFrozen);

      shippingDiscountPence = Math.round((ship * pct) / 100);
    }

    return NextResponse.json({
      ok: true,
      auto: true,
      promotionId: best.id,
      name: best.name,
      discountPence,
      shippingDiscountPence
    });
  }

  // ============================================
  // 🔥 MANUAL CODE MODE
  // ============================================

  const promoCode = normalizeCode(code!);

  const promo = await prisma.promotion.findUnique({
    where: { code: promoCode },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      startsAt: true,
      endsAt: true,
      eligibleCustomerScope: true,
      allowedUsers: userId ? { where: { userId }, select: { userId: true } } : false,
      lockedToUserId: true,
      lockedToEmail: true,
      maxUsesTotal: true,
      maxUsesPerUser: true,
      discountType: true,
      percentOff: true,
      amountOffPence: true,
      applyShippingDiscount: true,
      shippingPercentOffDry: true,
      shippingPercentOffFrozen: true,
      targetType: true,
      categories: { select: { categoryId: true } },
      products: { select: { productId: true } }
    }
  });

  if (!promo) return bad('INVALID_CODE', 404);

  const now = new Date();

  if (promo.status !== 'ACTIVE') return bad('PROMO_NOT_ACTIVE');
  if (promo.startsAt && now < promo.startsAt) return bad('PROMO_NOT_STARTED');
  if (promo.endsAt && now > promo.endsAt) return bad('PROMO_EXPIRED');

  if (promo.eligibleCustomerScope === 'USERS') {
    if (!userId) return bad('LOGIN_REQUIRED', 401);
    const allowed =
      Array.isArray(promo.allowedUsers) && promo.allowedUsers.some((x) => x.userId === userId);
    if (!allowed) return bad('NOT_ELIGIBLE_USER', 403);
  }

  if (promo.lockedToUserId && promo.lockedToUserId !== (userId ?? null))
    return bad('PROMO_LOCKED_TO_USER');

  if (promo.lockedToEmail && promo.lockedToEmail.trim().toLowerCase() !== emailNorm)
    return bad('PROMO_LOCKED_TO_EMAIL');

  const matchedSubtotal = sub;

  let discountPence = 0;

  if (promo.discountType === 'PERCENT') {
    discountPence = Math.round((matchedSubtotal * clampPct(promo.percentOff ?? 0)) / 100);
  } else if (promo.discountType === 'AMOUNT') {
    discountPence = Math.min(matchedSubtotal, promo.amountOffPence ?? 0);
  } else if (promo.discountType === 'PRODUCT_100') {
    discountPence = matchedSubtotal;
  }

  let shippingDiscountPence = 0;
  if (promo.applyShippingDiscount) {
    const pctDry = clampPct(promo.shippingPercentOffDry ?? 0);
    const pctFrozen = clampPct(promo.shippingPercentOffFrozen ?? 0);
    const pct =
      kind === 'FROZEN' ? pctFrozen : kind === 'DRY' ? pctDry : Math.max(pctDry, pctFrozen);

    shippingDiscountPence = Math.round((ship * pct) / 100);
  }

  await logAttempt({
    checkoutId,
    code: promoCode,
    promotionId: promo.id,
    userId: userId ?? null,
    email: email ?? null,
    outcome: 'EVAL_OK',
    currency: cur,
    subtotalPence: sub,
    shippingPence: ship,
    discountPence,
    shippingDiscountPence
  });

  return NextResponse.json({
    ok: true,
    currency: cur,
    promotionId: promo.id,
    code: promo.code,
    name: promo.name,
    discountPence,
    shippingDiscountPence
  });
}
