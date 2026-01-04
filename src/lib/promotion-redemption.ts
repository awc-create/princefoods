// src/lib/promotion-redemption.ts
import { prisma } from '@/lib/prisma';

type RedeemResult =
  | { ok: true; created: true }
  | { ok: true; created: false }
  | { ok: false; error: string };

/**
 * Redeem the promo on payment capture.
 * - Idempotent: one redemption per order (orderId is unique in PromotionRedemption)
 * - Hard-enforces maxUsesTotal / maxUsesPerUser at redemption time
 */
export async function redeemPromotionForPaidOrder(orderId: string): Promise<RedeemResult> {
  if (!orderId?.trim()) return { ok: false, error: 'MISSING_ORDER_ID' };

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          userId: true,
          contactEmail: true,
          promotionId: true,
          promotionCode: true,
          discountTotal: true
        }
      });

      if (!order) return { ok: false, error: 'ORDER_NOT_FOUND' };
      if (!order.promotionId || !order.promotionCode) return { ok: true, created: false };

      // already redeemed?
      const existing = await tx.promotionRedemption.findUnique({
        where: { orderId: order.id },
        select: { id: true }
      });
      if (existing) return { ok: true, created: false };

      const promo = await tx.promotion.findUnique({
        where: { id: order.promotionId },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          lockedToUserId: true,
          lockedToEmail: true,
          maxUsesTotal: true,
          maxUsesPerUser: true
        }
      });
      if (!promo) return { ok: false, error: 'PROMO_NOT_FOUND' };

      const now = new Date();
      if (promo.status !== 'ACTIVE') return { ok: false, error: 'PROMO_NOT_ACTIVE' };
      if (promo.startsAt && now < promo.startsAt) return { ok: false, error: 'PROMO_NOT_STARTED' };
      if (promo.endsAt && now > promo.endsAt) return { ok: false, error: 'PROMO_EXPIRED' };

      const emailNorm = (order.contactEmail ?? '').trim().toLowerCase();

      if (promo.lockedToUserId && promo.lockedToUserId !== order.userId) {
        return { ok: false, error: 'PROMO_LOCKED_TO_USER' };
      }
      if (promo.lockedToEmail && promo.lockedToEmail.trim().toLowerCase() !== emailNorm) {
        return { ok: false, error: 'PROMO_LOCKED_TO_EMAIL' };
      }

      if (promo.maxUsesTotal != null && promo.maxUsesTotal >= 0) {
        const used = await tx.promotionRedemption.count({ where: { promotionId: promo.id } });
        if (used >= promo.maxUsesTotal) return { ok: false, error: 'PROMO_MAX_USES_REACHED' };
      }

      if (promo.maxUsesPerUser != null && promo.maxUsesPerUser >= 0) {
        if (order.userId) {
          const used = await tx.promotionRedemption.count({
            where: { promotionId: promo.id, userId: order.userId }
          });
          if (used >= promo.maxUsesPerUser)
            return { ok: false, error: 'PROMO_MAX_USES_PER_USER_REACHED' };
        } else if (emailNorm) {
          const used = await tx.promotionRedemption.count({
            where: { promotionId: promo.id, emailUsed: emailNorm }
          });
          if (used >= promo.maxUsesPerUser)
            return { ok: false, error: 'PROMO_MAX_USES_PER_EMAIL_REACHED' };
        }
      }

      // MVP: we store what the order actually discounted (discountTotal).
      // If you later want to separate item discount vs shipping discount,
      // store both in Order (or compute + snapshot here) and fill both fields.
      await tx.promotionRedemption.create({
        data: {
          promotionId: promo.id,
          orderId: order.id,
          userId: order.userId ?? undefined,
          emailUsed: order.userId ? undefined : emailNorm || undefined,
          discountPence: order.discountTotal ?? 0,
          shippingDiscountPence: 0
        }
      });

      return { ok: true, created: true };
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'REDEEM_FAILED' };
  }
}
