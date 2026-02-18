// src/app/api/promotions/evaluate/route.ts
import { prisma } from '@/lib/prisma';
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
  // ensure integer 0..100
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
    // ignore logging failures
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  if (typeof body !== 'object' || body === null) return bad('BAD_REQUEST');

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

  if (!code || typeof code !== 'string') {
    await logAttempt({
      checkoutId,
      code: '',
      outcome: 'EVAL_ERR',
      errorCode: 'CODE_REQUIRED',
      currency: cur,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('CODE_REQUIRED');
  }

  const promoCode = normalizeCode(code);
  if (!promoCode) {
    await logAttempt({
      checkoutId,
      code: '',
      outcome: 'EVAL_ERR',
      errorCode: 'CODE_REQUIRED',
      currency: cur,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('CODE_REQUIRED');
  }

  if (!Array.isArray(items) || items.length === 0) {
    await logAttempt({
      checkoutId,
      code: promoCode,
      outcome: 'EVAL_ERR',
      errorCode: 'NO_ITEMS',
      currency: cur,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('NO_ITEMS');
  }

  // ✅ validate items properly
  for (const it of items) {
    if (!isNonNegInt(it.unitPrice)) {
      await logAttempt({
        checkoutId,
        code: promoCode,
        outcome: 'EVAL_ERR',
        errorCode: 'BAD_ITEM_PRICE',
        currency: cur,
        userId: userId ?? null,
        email: email ?? null
      });
      return bad('BAD_ITEM_PRICE');
    }
    if (!isPosInt(it.quantity)) {
      await logAttempt({
        checkoutId,
        code: promoCode,
        outcome: 'EVAL_ERR',
        errorCode: 'BAD_ITEM_QTY',
        currency: cur,
        userId: userId ?? null,
        email: email ?? null
      });
      return bad('BAD_ITEM_QTY');
    }
  }

  const sub = subtotalFor(items);
  const ship = isNonNegInt(shippingPence) ? shippingPence : 0;
  const kind: ShippingKind = shippingKind ?? 'DRY';

  const promo = await prisma.promotion.findUnique({
    where: { code: promoCode },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      startsAt: true,
      endsAt: true,

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

  if (!promo) {
    await logAttempt({
      checkoutId,
      code: promoCode,
      outcome: 'EVAL_ERR',
      errorCode: 'INVALID_CODE',
      currency: cur,
      subtotalPence: sub,
      shippingPence: ship,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('INVALID_CODE', 404);
  }

  const now = new Date();

  if (promo.status !== 'ACTIVE') {
    await logAttempt({
      checkoutId,
      code: promoCode,
      promotionId: promo.id,
      outcome: 'EVAL_ERR',
      errorCode: 'PROMO_NOT_ACTIVE',
      currency: cur,
      subtotalPence: sub,
      shippingPence: ship,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('PROMO_NOT_ACTIVE', 400);
  }

  if (promo.startsAt && now < promo.startsAt) {
    await logAttempt({
      checkoutId,
      code: promoCode,
      promotionId: promo.id,
      outcome: 'EVAL_ERR',
      errorCode: 'PROMO_NOT_STARTED',
      currency: cur,
      subtotalPence: sub,
      shippingPence: ship,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('PROMO_NOT_STARTED', 400);
  }

  if (promo.endsAt && now > promo.endsAt) {
    await logAttempt({
      checkoutId,
      code: promoCode,
      promotionId: promo.id,
      outcome: 'EVAL_ERR',
      errorCode: 'PROMO_EXPIRED',
      currency: cur,
      subtotalPence: sub,
      shippingPence: ship,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('PROMO_EXPIRED', 400);
  }

  const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (promo.lockedToUserId && promo.lockedToUserId !== (userId ?? null)) {
    await logAttempt({
      checkoutId,
      code: promoCode,
      promotionId: promo.id,
      outcome: 'EVAL_ERR',
      errorCode: 'PROMO_LOCKED_TO_USER',
      currency: cur,
      subtotalPence: sub,
      shippingPence: ship,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('PROMO_LOCKED_TO_USER', 403);
  }

  if (promo.lockedToEmail && promo.lockedToEmail.trim().toLowerCase() !== emailNorm) {
    await logAttempt({
      checkoutId,
      code: promoCode,
      promotionId: promo.id,
      outcome: 'EVAL_ERR',
      errorCode: 'PROMO_LOCKED_TO_EMAIL',
      currency: cur,
      subtotalPence: sub,
      shippingPence: ship,
      userId: userId ?? null,
      email: email ?? null
    });
    return bad('PROMO_LOCKED_TO_EMAIL', 403);
  }

  // total uses
  if (promo.maxUsesTotal != null && promo.maxUsesTotal >= 0) {
    const used = await prisma.promotionRedemption.count({ where: { promotionId: promo.id } });
    if (used >= promo.maxUsesTotal) {
      await logAttempt({
        checkoutId,
        code: promoCode,
        promotionId: promo.id,
        outcome: 'EVAL_ERR',
        errorCode: 'PROMO_MAX_USES_REACHED',
        currency: cur,
        subtotalPence: sub,
        shippingPence: ship,
        userId: userId ?? null,
        email: email ?? null
      });
      return bad('PROMO_MAX_USES_REACHED', 400);
    }
  }

  // per user/email uses
  if (promo.maxUsesPerUser != null && promo.maxUsesPerUser >= 0) {
    if (userId) {
      const used = await prisma.promotionRedemption.count({
        where: { promotionId: promo.id, userId }
      });
      if (used >= promo.maxUsesPerUser) return bad('PROMO_MAX_USES_PER_USER_REACHED', 400);
    } else if (emailNorm) {
      const used = await prisma.promotionRedemption.count({
        where: { promotionId: promo.id, emailUsed: emailNorm }
      });
      if (used >= promo.maxUsesPerUser) return bad('PROMO_MAX_USES_PER_EMAIL_REACHED', 400);
    }
  }

  // target filtering
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];

  const products =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, categoryId: true }
        })
      : [];

  const catByProductId = new Map(products.map((p) => [p.id, p.categoryId ?? null]));

  let matched: EvalItem[] = items;

  if (promo.targetType === 'PRODUCTS') {
    const allowed = new Set(promo.products.map((p) => p.productId));
    matched = items.filter((it) => !!it.productId && allowed.has(it.productId));
  } else if (promo.targetType === 'CATEGORIES') {
    const allowedCats = new Set(promo.categories.map((c) => c.categoryId));
    matched = items.filter((it) => {
      if (!it.productId) return false;
      const cid = catByProductId.get(it.productId) ?? null;
      return !!cid && allowedCats.has(cid);
    });
  }

  const matchedSubtotal = matched.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);

  let discountPence = 0;

  if (promo.discountType === 'PERCENT') {
    const pct = clampPct(promo.percentOff ?? 0);
    discountPence = Math.round((matchedSubtotal * pct) / 100);
  } else if (promo.discountType === 'AMOUNT') {
    discountPence = Math.max(0, Math.min(matchedSubtotal, promo.amountOffPence ?? 0));
  } else if (promo.discountType === 'PRODUCT_100') {
    discountPence = matchedSubtotal;
  }

  discountPence = Math.max(0, Math.min(discountPence, sub));

  let shippingDiscountPence = 0;
  if (promo.applyShippingDiscount) {
    const pctDry = clampPct(promo.shippingPercentOffDry ?? 0);
    const pctFrozen = clampPct(promo.shippingPercentOffFrozen ?? 0);

    const pct =
      kind === 'FROZEN' ? pctFrozen : kind === 'DRY' ? pctDry : Math.max(pctDry, pctFrozen);

    shippingDiscountPence = Math.round((ship * pct) / 100);
    shippingDiscountPence = Math.max(0, Math.min(shippingDiscountPence, ship));
  }

  await logAttempt({
    checkoutId,
    code: promoCode,
    promotionId: promo.id,
    userId: userId ?? null,
    email: email ?? null,
    outcome: 'EVAL_OK',
    errorCode: null,
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
