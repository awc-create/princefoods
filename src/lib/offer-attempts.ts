// src/lib/offer-attempts.ts
import { prisma } from '@/lib/prisma';

/**
 * Keep in sync with Prisma enum OfferAttemptOutcome
 * (you defined it in schema.prisma).
 */
export type OfferAttemptOutcome =
  | 'EVAL_OK'
  | 'EVAL_ERR'
  | 'ORDER_APPLIED'
  | 'ORDER_NOT_APPLIED'
  | 'ORDER_REJECTED'
  | 'ORDER_USED';

/**
 * Input used by route handlers (flexible).
 * NOTE: offerId is REQUIRED because Prisma OfferAttempt.offerId is required.
 */
export interface OfferAttemptCreate {
  checkoutId?: string | null;

  offerId: string; // ✅ required
  offerName?: string | null;
  offerKind?: string | null;

  userId?: string | null;
  email?: string | null;

  orderId?: string | null;

  outcome: OfferAttemptOutcome;
  errorCode?: string | null;

  currency: string;
  subtotalPence?: number | null;
  shippingPence?: number | null;
  discountPence?: number;
  shippingDiscountPence?: number;

  usedAt?: Date | null;
}

function normStr(v: string | null | undefined, max = 255): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normCurrency(v: string | null | undefined): string {
  const t = (v ?? 'GBP').trim().toUpperCase();
  return t || 'GBP';
}

function moneyInt(v: number | null | undefined): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
  return Math.max(0, n);
}

function safeOfferId(v: string | null | undefined): string {
  const t = (v ?? '').trim();
  if (t) return t.slice(0, 80);
  return 'UNKNOWN';
}

/**
 * Best-effort bulk insert.
 * Uses prisma.offerAttempt.createMany.
 */
export async function logOfferAttemptsBulk(rows: OfferAttemptCreate[]) {
  if (!rows.length) return;

  const data = rows.slice(0, 200).map((r) => ({
    checkoutId: normStr(r.checkoutId, 128),

    // ✅ REQUIRED (schema requires String)
    offerId: safeOfferId(r.offerId),

    offerName: normStr(r.offerName, 120),
    offerKind: normStr(r.offerKind, 80),

    userId: normStr(r.userId, 64),
    email: normStr(r.email, 320),

    orderId: normStr(r.orderId, 64),

    outcome: r.outcome,
    errorCode: normStr(r.errorCode, 80),

    currency: normCurrency(r.currency),

    subtotalPence: r.subtotalPence == null ? null : moneyInt(r.subtotalPence),
    shippingPence: r.shippingPence == null ? null : moneyInt(r.shippingPence),

    discountPence: moneyInt(r.discountPence),
    shippingDiscountPence: moneyInt(r.shippingDiscountPence),

    usedAt: r.usedAt ?? null
  }));

  try {
    await prisma.offerAttempt.createMany({ data });
  } catch {
    // ignore (best-effort logging)
  }
}

/**
 * Webhook usage:
 * mark all offer attempts linked to order as used (idempotent)
 */
export async function markOffersUsedByOrder(orderId: string, usedAt: Date = new Date()) {
  const id = (orderId ?? '').trim();
  if (!id) return;

  try {
    await prisma.offerAttempt.updateMany({
      where: { orderId: id, usedAt: null },
      data: { usedAt, outcome: 'ORDER_USED' }
    });
  } catch {
    // ignore
  }
}
