// src/lib/promotions/attempts.ts
import { prisma } from '@/lib/prisma';

function normCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

type AttemptOutcome =
  | 'EVAL_OK'
  | 'EVAL_ERR'
  | 'ORDER_APPLIED'
  | 'ORDER_NOT_APPLIED'
  | 'ORDER_REJECTED';

interface TrackAttemptArgs {
  checkoutId?: string | null;

  code: string;
  outcome: AttemptOutcome;
  errorCode?: string | null;

  promotionId?: string | null;

  userId?: string | null;
  email?: string | null;

  orderId?: string | null;

  currency?: string;
  subtotalPence?: number | null;
  shippingPence?: number | null;
  discountPence?: number;
  shippingDiscountPence?: number;
}

export async function trackPromotionAttempt(a: TrackAttemptArgs) {
  const code = normCode(a.code);
  if (!code) return;

  await prisma.promotionAttempt.create({
    data: {
      checkoutId: a.checkoutId ?? null,

      code,
      outcome: a.outcome,
      errorCode: a.errorCode ?? null,

      promotionId: a.promotionId ?? null,

      userId: a.userId ?? null,
      email: a.email ?? null,

      orderId: a.orderId ?? null,

      currency: a.currency ?? 'GBP',
      subtotalPence: a.subtotalPence ?? null,
      shippingPence: a.shippingPence ?? null,
      discountPence: Math.max(0, Math.trunc(a.discountPence ?? 0)),
      shippingDiscountPence: Math.max(0, Math.trunc(a.shippingDiscountPence ?? 0))
    }
  });
}
