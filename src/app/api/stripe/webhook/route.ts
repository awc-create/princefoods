// src/app/api/stripe/webhook/route.ts
import { markOffersUsedByOrder } from '@/lib/offer-attempts';
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { redeemPromotionForPaidOrder } from '@/lib/promotion-redemption';
import { markPromotionUsedByOrder } from '@/lib/promotions/mark-used';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Raw body for signature verification */
async function rawBody(req: NextRequest): Promise<string> {
  return await req.text();
}

/** Prisma helpers */
function isPrismaKnownError(e: unknown): e is { code: string } {
  return (
    typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).code === 'string'
  );
}
function isUniqueViolation(e: unknown): boolean {
  return isPrismaKnownError(e) && e.code === 'P2002';
}

/** Safe Json casting helper (for Prisma Json columns) */
function asJson(v: unknown): Prisma.InputJsonValue {
  return v as Prisma.InputJsonValue;
}

/** Accept either internal id or displayId */
async function findOrderByIdOrDisplay(idOrDisplay: string | null | undefined) {
  const key = (idOrDisplay ?? '').trim();
  if (!key) return null;

  const byId = await prisma.order.findUnique({ where: { id: key }, select: { id: true } });
  if (byId) return byId.id;

  const byDisplay = await prisma.order.findUnique({
    where: { displayId: key },
    select: { id: true }
  });
  return byDisplay?.id ?? null;
}

/** Find order by PaymentIntent id */
async function findOrderIdByPI(piId: string | null | undefined) {
  const id = (piId ?? '').trim();
  if (!id) return null;

  const order = await prisma.order.findFirst({
    where: { paymentIntentId: id },
    select: { id: true }
  });
  return order?.id ?? null;
}

/** Shared refund handler */
async function applyRefundToOrder(args: {
  orderId: string;
  refundId?: string | null;
  amount: number; // pence
  currency?: string | null;
}) {
  const { orderId, refundId, amount, currency } = args;
  if (!Number.isFinite(amount) || amount <= 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, grandTotal: true, refundTotal: true }
  });
  if (!order) return;

  const newRefundTotal = (order.refundTotal ?? 0) + amount;
  const fullyRefunded = newRefundTotal >= (order.grandTotal ?? 0);

  await prisma.order.update({
    where: { id: orderId },
    data: {
      refundTotal: { increment: amount },
      status: fullyRefunded ? 'CANCELLED' : 'REFUNDED',
      paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIAL_REFUND',
      canceledAt: fullyRefunded ? new Date() : undefined,
      canceledReason: fullyRefunded
        ? 'Stripe full refund processed automatically'
        : 'Stripe partial refund processed automatically'
    }
  });

  // refundId is not unique in your schema: keep it safe
  const existing = refundId ? await prisma.payment.findFirst({ where: { refundId } }) : null;

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { amountPence: -amount, status: 'REFUNDED' }
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId,
        provider: 'stripe',
        amountPence: -amount,
        currency: (currency ?? 'gbp').toUpperCase(),
        status: 'REFUNDED',
        refundId: refundId ?? undefined
      }
    });
  }

  await logActivity(
    orderId,
    fullyRefunded ? 'CANCELLED' : 'REFUNDED',
    fullyRefunded ? 'Stripe full refund completed' : 'Stripe partial refund completed',
    asJson({ stripeRefundId: refundId ?? undefined, amountPence: amount })
  );
}

async function redeemIfNeeded(orderId: string) {
  const redeemed = await redeemPromotionForPaidOrder(orderId);

  if (redeemed.ok && redeemed.created) {
    await logActivity(orderId, 'NOTE', 'Promotion redeemed on capture');
  } else if (!redeemed.ok) {
    await logActivity(
      orderId,
      'NOTE',
      'Promotion redemption failed (capture)',
      asJson({ error: redeemed.error })
    );
  }
}

/**
 * Idempotent capture writer:
 * - Updates order only if not already captured
 * - Avoids duplicate payments (by intentId when present)
 */
async function markOrderCaptured(args: {
  orderId: string;
  providerLabel: string;
  intentId: string | null;
  amountPence: number;
  currency: string | null | undefined;
  context?: Prisma.InputJsonValue;
}) {
  const { orderId, providerLabel, intentId, amountPence, currency, context } = args;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, paymentStatus: true, paymentIntentId: true }
  });
  if (!order) return;

  const alreadyCaptured = order.paymentStatus === 'CAPTURED' || order.status === 'PAID';
  const finalIntentId = intentId?.trim() ? intentId.trim() : (order.paymentIntentId ?? null);

  if (!alreadyCaptured) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
        paymentStatus: 'CAPTURED',
        paymentProvider: providerLabel,
        paymentIntentId: finalIntentId ?? undefined
      }
    });

    // ✅ first capture marks promo used
    await markPromotionUsedByOrder(orderId);

    // ✅ first capture marks offers used
    await markOffersUsedByOrder(orderId);
  } else if (finalIntentId && !order.paymentIntentId) {
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentIntentId: finalIntentId }
    });

    await markPromotionUsedByOrder(orderId);
    await markOffersUsedByOrder(orderId);
  }

  // Payment idempotency
  if (finalIntentId) {
    const existingByIntent = await prisma.payment.findFirst({ where: { intentId: finalIntentId } });
    if (existingByIntent) {
      await prisma.payment.update({
        where: { id: existingByIntent.id },
        data: {
          orderId,
          provider: 'stripe',
          amountPence: Math.max(0, Math.trunc(amountPence)),
          currency: (currency ?? 'gbp').toUpperCase(),
          status: 'CAPTURED'
        }
      });
    } else {
      await prisma.payment.create({
        data: {
          orderId,
          provider: 'stripe',
          intentId: finalIntentId,
          chargeId: null,
          amountPence: Math.max(0, Math.trunc(amountPence)),
          currency: (currency ?? 'gbp').toUpperCase(),
          status: 'CAPTURED'
        }
      });
    }
  } else {
    const existingCaptured = await prisma.payment.findFirst({
      where: { orderId, provider: 'stripe', status: 'CAPTURED' }
    });
    if (!existingCaptured) {
      await prisma.payment.create({
        data: {
          orderId,
          provider: 'stripe',
          intentId: undefined,
          chargeId: null,
          amountPence: Math.max(0, Math.trunc(amountPence)),
          currency: (currency ?? 'gbp').toUpperCase(),
          status: 'CAPTURED'
        }
      });
    }
  }

  // Promo redemption is idempotent in your schema (orderId is @unique)
  await redeemIfNeeded(orderId);

  // Only log once
  if (!alreadyCaptured) {
    await logActivity(orderId, 'PAID', 'Stripe payment captured', context);
  }
}

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'Stripe webhook not configured yet' },
      { status: 200 }
    );
  }

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;

  try {
    const payload = await rawBody(req);
    const sig = req.headers.get('stripe-signature');
    if (!sig)
      return NextResponse.json({ ok: false, error: 'Missing stripe-signature' }, { status: 400 });

    event = await stripe.webhooks.constructEventAsync(payload, sig, webhookSecret);

    // ✅ Idempotent event insert
    try {
      await prisma.webhookEvent.create({
        data: {
          source: 'stripe',
          type: event.type,
          eventId: event.id,
          payload: asJson(event)
        }
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;

      const existing = await prisma.webhookEvent.findUnique({
        where: { eventId: event.id },
        select: { processedAt: true }
      });
      if (existing?.processedAt) {
        return NextResponse.json({ received: true, idempotent: true });
      }
      // Exists but not processed → continue
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid webhook';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const providerLabel = event.livemode ? 'stripe' : 'test';
  const type = event.type as string;

  try {
    if (type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const orderId = await findOrderByIdOrDisplay(session.client_reference_id);
      if (orderId) {
        const amountTotal = session.amount_total ?? 0;

        const intentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

        await markOrderCaptured({
          orderId,
          providerLabel,
          intentId,
          amountPence: amountTotal,
          currency: session.currency,
          context: asJson({ sessionId: session.id, intentId: intentId ?? undefined })
        });
      }
    } else if (type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;

      let orderId = await findOrderByIdOrDisplay(pi.metadata?.orderId);
      orderId ??= await findOrderByIdOrDisplay(pi.metadata?.displayId);
      orderId ??= await findOrderIdByPI(pi.id);

      if (orderId) {
        const amt = pi.amount_received ?? pi.amount ?? 0;

        await markOrderCaptured({
          orderId,
          providerLabel,
          intentId: pi.id,
          amountPence: amt,
          currency: pi.currency,
          context: asJson({ intentId: pi.id, amount: amt })
        });
      }
    } else if (type === 'refund.succeeded') {
      const refund = event.data.object as Stripe.Refund;

      const paymentIntentId =
        typeof refund.payment_intent === 'string'
          ? refund.payment_intent
          : refund.payment_intent?.toString();

      const orderId = await findOrderIdByPI(paymentIntentId);
      if (orderId) {
        await applyRefundToOrder({
          orderId,
          refundId: refund.id,
          amount: refund.amount ?? 0,
          currency: refund.currency
        });
      }
    } else if (type === 'charge.refunded') {
      const ch = event.data.object as Stripe.Charge;

      const piId =
        typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.toString();

      const firstRefund = ch.refunds?.data?.[0];
      const orderId = await findOrderIdByPI(piId ?? undefined);

      if (orderId && firstRefund) {
        await applyRefundToOrder({
          orderId,
          refundId: firstRefund.id,
          amount: firstRefund.amount ?? 0,
          currency: firstRefund.currency ?? ch.currency
        });
      } else if (!orderId) {
        const pay = await prisma.payment.findFirst({ where: { chargeId: ch.id } });
        if (pay) {
          await prisma.payment.update({
            where: { id: pay.id },
            data: { status: 'REFUNDED', refundId: firstRefund?.id ?? pay.refundId }
          });
          await prisma.order.update({
            where: { id: pay.orderId },
            data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' }
          });

          await logActivity(
            pay.orderId,
            'REFUNDED',
            'Charge refunded',
            asJson({ chargeId: ch.id, refundId: firstRefund?.id })
          );
        }
      }
    } else if (type === 'payment_intent.canceled') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = await findOrderIdByPI(pi.id);
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'REFUNDED',
            status: 'CANCELLED',
            canceledAt: new Date(),
            canceledReason: 'Stripe payment intent canceled'
          }
        });

        await logActivity(
          orderId,
          'CANCELLED',
          'Stripe payment intent canceled',
          asJson({ intentId: pi.id })
        );
      }
    }

    await prisma.webhookEvent.updateMany({
      where: { eventId: event.id },
      data: { processedAt: new Date(), success: true }
    });

    return NextResponse.json({ received: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Processing error';

    await prisma.webhookEvent.updateMany({
      where: { eventId: (event as Stripe.Event).id },
      data: { processedAt: new Date(), success: false, error: msg }
    });

    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
