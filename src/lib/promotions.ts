// src/lib/promotions.ts
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

type Money = number; // pence int

export interface PromoQuoteItem {
  productId?: string | null;
  unitPrice: Money; // pence
  quantity: number;
}

export interface PromoQuoteInput {
  code: string;
  userId?: string | null;
  emailUsed?: string | null;

  // Cart
  items: PromoQuoteItem[];

  // Optional (future): if you later split shipping into dry/frozen totals,
  // pass them here to enable shippingPercentOffDry/Frozen.
  shippingDryPence?: Money;
  shippingFrozenPence?: Money;
}

export type PromoQuoteResult =
  | {
      ok: true;
      promotionId: string;
      promotionCode: string;
      discountPence: Money;
      shippingDiscountPence: Money;
      reasons: string[]; // can include warnings (e.g. "Limited to 1 use per user")
    }
  | {
      ok: false;
      promotionCode: string;
      error: string;
      reasons: string[];
    };

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function isFiniteInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

export function normalizePromotionCode(raw: string) {
  return (raw ?? '').trim().toUpperCase();
}

function nowUtc() {
  return new Date();
}

function sumLineTotal(items: PromoQuoteItem[]) {
  let sum = 0;
  for (const it of items) {
    const qty = isFiniteInt(it.quantity) ? it.quantity : 0;
    const unit = isFiniteInt(it.unitPrice) ? it.unitPrice : 0;
    if (qty > 0 && unit >= 0) sum += unit * qty;
  }
  return sum;
}

function safeEmail(raw: string | null | undefined) {
  const t = (raw ?? '').trim();
  return t ? t : null;
}

function safeUserId(raw: string | null | undefined) {
  const t = (raw ?? '').trim();
  return t ? t : null;
}

/**
 * Determine if promotion is active at the current time.
 */
function promoWindowOk(p: { startsAt: Date | null; endsAt: Date | null }) {
  const n = nowUtc();
  if (p.startsAt && n < p.startsAt) return false;
  if (p.endsAt && n > p.endsAt) return false;
  return true;
}

/**
 * Eligibility lock check (user/email).
 * - If lockedToUserId is set => must match userId
 * - If lockedToEmail is set => must match provided emailUsed or session email
 */
function promoLockOk(args: {
  lockedToUserId: string | null;
  lockedToEmail: string | null;
  userId: string | null;
  emailUsed: string | null;
}) {
  const { lockedToUserId, lockedToEmail, userId, emailUsed } = args;

  if (lockedToUserId) {
    if (!userId) return false;
    if (lockedToUserId !== userId) return false;
  }

  if (lockedToEmail) {
    const e = safeEmail(emailUsed);
    if (!e) return false;
    if (lockedToEmail.trim().toLowerCase() !== e.toLowerCase()) return false;
  }

  return true;
}

/**
 * Target filtering:
 * - SITE_WIDE => all items eligible
 * - PRODUCTS => only items whose productId in PromotionProduct
 * - CATEGORIES => only items whose product categoryId in PromotionCategory
 */
async function computeEligibleItems(args: {
  promotionId: string;
  targetType: 'SITE_WIDE' | 'CATEGORIES' | 'PRODUCTS';
  items: PromoQuoteItem[];
}) {
  const { promotionId, targetType, items } = args;

  if (targetType === 'SITE_WIDE') {
    return { eligibleItems: items, eligibleSubtotal: sumLineTotal(items) };
  }

  const productIds = Array.from(new Set(items.map((i) => i.productId).filter(Boolean) as string[]));

  if (productIds.length === 0) {
    return { eligibleItems: [] as PromoQuoteItem[], eligibleSubtotal: 0 };
  }

  if (targetType === 'PRODUCTS') {
    const rows = await prisma.promotionProduct.findMany({
      where: { promotionId },
      select: { productId: true }
    });
    const allowed = new Set(rows.map((r) => r.productId));
    const eligibleItems = items.filter((i) => i.productId && allowed.has(i.productId));
    return { eligibleItems, eligibleSubtotal: sumLineTotal(eligibleItems) };
  }

  // CATEGORIES
  const catRows = await prisma.promotionCategory.findMany({
    where: { promotionId },
    select: { categoryId: true }
  });
  const allowedCats = new Set(catRows.map((r) => r.categoryId));

  // Need product -> categoryId
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, categoryId: true }
  });
  const productToCat = new Map(products.map((p) => [p.id, p.categoryId ?? null]));

  const eligibleItems = items.filter((i) => {
    if (!i.productId) return false;
    const catId = productToCat.get(i.productId) ?? null;
    if (!catId) return false;
    return allowedCats.has(catId);
  });

  return { eligibleItems, eligibleSubtotal: sumLineTotal(eligibleItems) };
}

/**
 * Compute discount for eligible items based on promotion discount type.
 */
function computeItemDiscount(args: {
  discountType: 'PERCENT' | 'AMOUNT' | 'PRODUCT_100';
  percentOff: number | null;
  amountOffPence: number | null;
  eligibleSubtotal: Money;
}) {
  const { discountType, percentOff, amountOffPence, eligibleSubtotal } = args;

  if (eligibleSubtotal <= 0) return 0;

  if (discountType === 'PERCENT') {
    const pct = clampInt(Number(percentOff ?? 0), 0, 100);
    const discount = Math.floor((eligibleSubtotal * pct) / 100);
    return clampInt(discount, 0, eligibleSubtotal);
  }

  if (discountType === 'AMOUNT') {
    const amt = Math.max(0, Math.floor(Number(amountOffPence ?? 0)));
    return clampInt(amt, 0, eligibleSubtotal);
  }

  // PRODUCT_100
  return eligibleSubtotal;
}

/**
 * Compute shipping discount.
 * For now you said shipping prices are not set up => return 0.
 * Later, pass shippingDryPence / shippingFrozenPence to enable % discounts.
 */
function computeShippingDiscount(args: {
  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;
  shippingDryPence?: Money;
  shippingFrozenPence?: Money;
}) {
  if (!args.applyShippingDiscount) return 0;

  const dry = Math.max(0, Math.floor(args.shippingDryPence ?? 0));
  const frozen = Math.max(0, Math.floor(args.shippingFrozenPence ?? 0));

  // If you haven't implemented split yet, this will naturally be 0.
  if (dry <= 0 && frozen <= 0) return 0;

  const dryPct = clampInt(Number(args.shippingPercentOffDry ?? 0), 0, 100);
  const frozenPct = clampInt(Number(args.shippingPercentOffFrozen ?? 0), 0, 100);

  const dryDiscount = Math.floor((dry * dryPct) / 100);
  const frozenDiscount = Math.floor((frozen * frozenPct) / 100);

  return Math.max(0, dryDiscount + frozenDiscount);
}

/**
 * Quote (validate + compute discount) for a promo code.
 * Does NOT redeem. Safe to call from checkout UI.
 */
export async function quotePromotion(input: PromoQuoteInput): Promise<PromoQuoteResult> {
  const promotionCode = normalizePromotionCode(input.code);
  if (!promotionCode) {
    return { ok: false, promotionCode: '', error: 'EMPTY_CODE', reasons: ['Enter a code.'] };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return {
      ok: false,
      promotionCode,
      error: 'EMPTY_CART',
      reasons: ['No items to apply a promotion to.']
    };
  }

  const promo = await prisma.promotion.findUnique({
    where: { code: promotionCode },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      type: true,
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

      targetType: true
    }
  });

  if (!promo) {
    return {
      ok: false,
      promotionCode,
      error: 'NOT_FOUND',
      reasons: ['That code is not recognised.']
    };
  }

  const reasons: string[] = [];

  if (promo.status !== 'ACTIVE') {
    return {
      ok: false,
      promotionCode,
      error: 'NOT_ACTIVE',
      reasons: ['This promotion is not active.']
    };
  }

  if (!promoWindowOk(promo)) {
    return {
      ok: false,
      promotionCode,
      error: 'OUTSIDE_WINDOW',
      reasons: ['This promotion is not currently valid.']
    };
  }

  const userId = safeUserId(input.userId);
  const emailUsed = safeEmail(input.emailUsed);

  if (
    !promoLockOk({
      lockedToUserId: promo.lockedToUserId,
      lockedToEmail: promo.lockedToEmail,
      userId,
      emailUsed
    })
  ) {
    return {
      ok: false,
      promotionCode,
      error: 'LOCKED',
      reasons: ['This code is not eligible for this customer/email.']
    };
  }

  // Best-effort usage limit checks (quote-time only; redemption will enforce again in a tx)
  if (promo.maxUsesTotal != null && promo.maxUsesTotal >= 0) {
    const totalUsed = await prisma.promotionRedemption.count({ where: { promotionId: promo.id } });
    if (totalUsed >= promo.maxUsesTotal) {
      return {
        ok: false,
        promotionCode,
        error: 'MAX_TOTAL_REACHED',
        reasons: ['This code has reached its usage limit.']
      };
    }
  }

  if (promo.maxUsesPerUser != null && promo.maxUsesPerUser >= 0) {
    // logged-in user check
    if (userId) {
      const usedByUser = await prisma.promotionRedemption.count({
        where: { promotionId: promo.id, userId }
      });
      if (usedByUser >= promo.maxUsesPerUser) {
        return {
          ok: false,
          promotionCode,
          error: 'MAX_PER_USER_REACHED',
          reasons: ['This code has already been used by this account.']
        };
      }
    } else if (emailUsed) {
      // guest check by email
      const usedByEmail = await prisma.promotionRedemption.count({
        where: { promotionId: promo.id, emailUsed: emailUsed }
      });
      if (usedByEmail >= promo.maxUsesPerUser) {
        return {
          ok: false,
          promotionCode,
          error: 'MAX_PER_USER_REACHED',
          reasons: ['This code has already been used for this email.']
        };
      }
    } else {
      // no identity at all => you can still allow quote, but redemption will require emailUsed for guests.
      reasons.push('Guest checkout will require an email to redeem this code.');
    }
  }

  // Determine eligible items based on targets
  const { eligibleSubtotal } = await computeEligibleItems({
    promotionId: promo.id,
    targetType: promo.targetType,
    items: input.items
  });

  if (eligibleSubtotal <= 0) {
    return {
      ok: false,
      promotionCode,
      error: 'NO_ELIGIBLE_ITEMS',
      reasons: ['This code does not apply to items in your cart.']
    };
  }

  const discountPence = computeItemDiscount({
    discountType: promo.discountType,
    percentOff: promo.percentOff,
    amountOffPence: promo.amountOffPence,
    eligibleSubtotal
  });

  const shippingDiscountPence = computeShippingDiscount({
    applyShippingDiscount: promo.applyShippingDiscount,
    shippingPercentOffDry: promo.shippingPercentOffDry,
    shippingPercentOffFrozen: promo.shippingPercentOffFrozen,
    shippingDryPence: input.shippingDryPence,
    shippingFrozenPence: input.shippingFrozenPence
  });

  // Avoid negative / nonsense
  const finalDiscount = Math.max(0, Math.floor(discountPence));
  const finalShipDiscount = Math.max(0, Math.floor(shippingDiscountPence));

  return {
    ok: true,
    promotionId: promo.id,
    promotionCode: promo.code ?? promotionCode,
    discountPence: finalDiscount,
    shippingDiscountPence: finalShipDiscount,
    reasons
  };
}

/**
 * Redeem promotion ONLY once payment is CAPTURED.
 * This is called from Stripe webhook after order is marked PAID/CAPTURED.
 *
 * Idempotency:
 * - PromotionRedemption has orderId @unique, so duplicate attempts are safe.
 * - Uses SERIALIZABLE tx to prevent race on maxUsesTotal / maxUsesPerUser.
 */
export async function redeemPromotionOnCapturedPayment(args: {
  orderId: string;
  promotionId: string;
  promotionCode: string;
  userId: string | null;
  emailUsed: string | null;
}) {
  const orderId = (args.orderId ?? '').trim();
  const promotionId = (args.promotionId ?? '').trim();
  const promotionCode = normalizePromotionCode(args.promotionCode ?? '');
  const userId = safeUserId(args.userId);
  const emailUsed = safeEmail(args.emailUsed);

  if (!orderId || !promotionId || !promotionCode) return;

  // Must be captured/paid
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentStatus: true,
      status: true,
      promotionId: true,
      promotionCode: true,
      contactEmail: true,
      discountTotal: true,
      shippingTotal: true
    }
  });

  if (!order) return;
  if (order.paymentStatus !== 'CAPTURED') return;

  // If order promo changed or missing, do nothing
  if (!order.promotionId || !order.promotionCode) return;
  if (order.promotionId !== promotionId) return;
  if (normalizePromotionCode(order.promotionCode) !== promotionCode) return;

  // Use the order contact email as fallback for guests if not passed
  const emailForGuest = emailUsed ?? safeEmail(order.contactEmail);

  await prisma.$transaction(
    async (tx) => {
      // Idempotent: already redeemed for this order?
      const existing = await tx.promotionRedemption.findUnique({
        where: {
          orderId_promotionId: {
            orderId,
            promotionId
          }
        },
        select: { id: true }
      });

      if (existing) return;

      const promo = await tx.promotion.findUnique({
        where: { id: promotionId },
        select: {
          id: true,
          code: true,
          status: true,
          startsAt: true,
          endsAt: true,
          lockedToUserId: true,
          lockedToEmail: true,
          maxUsesTotal: true,
          maxUsesPerUser: true
        }
      });
      if (!promo) return;

      // Enforce status/window at redeem-time too
      if (promo.status !== 'ACTIVE') return;
      if (!promoWindowOk(promo)) return;

      // Enforce locks at redeem-time too
      if (
        !promoLockOk({
          lockedToUserId: promo.lockedToUserId,
          lockedToEmail: promo.lockedToEmail,
          userId,
          emailUsed: emailForGuest
        })
      ) {
        return;
      }

      // Enforce usage limits safely inside tx
      if (promo.maxUsesTotal != null && promo.maxUsesTotal >= 0) {
        const totalUsed = await tx.promotionRedemption.count({
          where: { promotionId: promo.id }
        });
        if (totalUsed >= promo.maxUsesTotal) return;
      }

      if (promo.maxUsesPerUser != null && promo.maxUsesPerUser >= 0) {
        if (userId) {
          const usedByUser = await tx.promotionRedemption.count({
            where: { promotionId: promo.id, userId }
          });
          if (usedByUser >= promo.maxUsesPerUser) return;
        } else if (emailForGuest) {
          const usedByEmail = await tx.promotionRedemption.count({
            where: { promotionId: promo.id, emailUsed: emailForGuest }
          });
          if (usedByEmail >= promo.maxUsesPerUser) return;
        } else {
          // No identity (should not happen because order has contactEmail)
          return;
        }
      }

      // Create immutable redemption log
      await tx.promotionRedemption.create({
        data: {
          promotionId: promo.id,
          orderId,
          userId: userId ?? undefined,
          emailUsed: emailForGuest ?? undefined,

          // Record what benefit was actually applied on the order.
          // NOTE: shippingDiscountPence should eventually be computed explicitly;
          // for now you can store 0 or infer if you later track it separately.
          discountPence: Math.max(0, order.discountTotal ?? 0),
          shippingDiscountPence: 0
        }
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}
