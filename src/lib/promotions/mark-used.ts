// src/lib/promotions/mark-used.ts (FULL)
// marks attempts for the order as USED (ORDER_USED) once payment is captured

import { prisma } from '@/lib/prisma';

export async function markPromotionUsedByOrder(orderId: string) {
  const id = orderId?.trim();
  if (!id) return { ok: false as const, error: 'Missing orderId' };

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      contactEmail: true,
      promotionId: true,
      promotionCode: true,
      currency: true,
      subtotal: true,
      shippingTotal: true,
      discountTotal: true
    }
  });

  if (!order) return { ok: false as const, error: 'Order not found' };

  // nothing to mark
  if (!order.promotionCode && !order.promotionId) return { ok: true as const, changed: false };

  const code = (order.promotionCode ?? '').trim().toUpperCase().replace(/\s+/g, '');
  const email = (order.contactEmail ?? '').trim().toLowerCase() || null;

  // try to update any existing attempt linked to this order
  const updated = await prisma.promotionAttempt.updateMany({
    where: {
      orderId: order.id,
      // don’t downgrade if already used
      outcome: { in: ['ORDER_APPLIED'] }
    },
    data: {
      outcome: 'ORDER_USED',
      usedAt: new Date(),
      // keep best-known values (optional)
      currency: (order.currency ?? 'GBP').toUpperCase(),
      subtotalPence: order.subtotal ?? null,
      shippingPence: order.shippingTotal ?? null,
      discountPence: Math.max(0, Math.trunc(order.discountTotal ?? 0)),
      shippingDiscountPence: 0
    }
  });

  if (updated.count > 0) return { ok: true as const, changed: true };

  // no attempt existed on the order (edge case) → write a synthetic ORDER_USED record
  // (still gives you the thread in admin)
  await prisma.promotionAttempt.create({
    data: {
      checkoutId: null,
      code: code || 'UNKNOWN',
      promotionId: order.promotionId ?? null,
      userId: order.userId ?? null,
      email,
      orderId: order.id,
      outcome: 'ORDER_USED',
      errorCode: null,
      currency: (order.currency ?? 'GBP').toUpperCase(),
      subtotalPence: order.subtotal ?? null,
      shippingPence: order.shippingTotal ?? null,
      discountPence: Math.max(0, Math.trunc(order.discountTotal ?? 0)),
      shippingDiscountPence: 0,
      usedAt: new Date()
    }
  });

  return { ok: true as const, changed: true };
}
