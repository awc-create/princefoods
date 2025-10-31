// src/app/api/stripe/webhook/route.ts
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Raw body for signature verification */
async function rawBody(req: NextRequest): Promise<string> {
  return await req.text();
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

/** Shared refund handler (works for refund.succeeded or data pulled from charge.refunded) */
async function applyRefundToOrder(args: {
  orderId: string;
  refundId?: string | null;
  amount: number; // pence
  currency?: string | null;
}) {
  const { orderId, refundId, amount, currency } = args;
  if (amount <= 0) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, grandTotal: true, refundTotal: true }
  });
  if (!order) return;

  const newRefundTotal = (order.refundTotal ?? 0) + amount;
  const fullyRefunded = newRefundTotal >= order.grandTotal;

  // Update order totals + status
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

  // Because refundId is NOT unique in your schema, use findFirst + create/update
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
    { stripeRefundId: refundId ?? undefined, amountPence: amount }
  );
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

    // audit
    await prisma.webhookEvent.create({
      data: {
        source: 'stripe',
        type: event.type,
        eventId: event.id,
        payload: event as unknown as object
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid webhook';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  const providerLabel = event.livemode ? 'stripe' : 'test';
  const type = event.type as string; // keep TS happy for newer event names

  try {
    // --------- payments captured via Checkout ---------
    if (type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      const orderId = await findOrderByIdOrDisplay(session.client_reference_id);
      if (orderId) {
        const amountTotal = session.amount_total ?? 0;
        const intentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'CAPTURED',
            paymentProvider: providerLabel,
            paymentIntentId: intentId ?? undefined
          }
        });

        await prisma.payment.create({
          data: {
            orderId,
            provider: 'stripe',
            intentId: intentId ?? undefined,
            chargeId: null,
            amountPence: amountTotal,
            currency: (session.currency ?? 'gbp').toUpperCase(),
            status: 'CAPTURED'
          }
        });

        await logActivity(orderId, 'PAID', 'Stripe checkout completed', {
          sessionId: session.id,
          intentId: intentId ?? undefined
        });
      }
    }

    // --------- payments captured directly (non-Checkout) ---------
    else if (type === 'payment_intent.succeeded') {
      const pi = event.data.object as Stripe.PaymentIntent;

      let orderId = await findOrderByIdOrDisplay(pi.metadata?.orderId);
      orderId ??= await findOrderByIdOrDisplay(pi.metadata?.displayId);
      orderId ??= await findOrderIdByPI(pi.id);

      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'CAPTURED',
            paymentProvider: providerLabel,
            paymentIntentId: pi.id
          }
        });

        const amt = pi.amount_received ?? pi.amount ?? 0;
        const existing = await prisma.payment.findFirst({ where: { intentId: pi.id } });
        if (existing) {
          await prisma.payment.update({
            where: { id: existing.id },
            data: { amountPence: amt || existing.amountPence, status: 'CAPTURED' }
          });
        } else {
          await prisma.payment.create({
            data: {
              orderId,
              provider: 'stripe',
              intentId: pi.id,
              chargeId: null,
              amountPence: amt,
              currency: (pi.currency ?? 'gbp').toUpperCase(),
              status: 'CAPTURED'
            }
          });
        }

        await logActivity(orderId, 'PAID', 'Stripe charge captured', {
          intentId: pi.id,
          amount: amt
        });
      }
    }

    // --------- canonical refund event (dashboard/API refunds) ---------
    else if (type === 'refund.succeeded') {
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
    }

    // --------- legacy/fallback refund event on Charge ---------
    else if (type === 'charge.refunded') {
      const ch = event.data.object as Stripe.Charge;

      const piId =
        typeof ch.payment_intent === 'string' ? ch.payment_intent : ch.payment_intent?.toString();

      // If a refund object is present, use its first record
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
        // fallback by chargeId if you ever stored it
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

          await logActivity(pay.orderId, 'REFUNDED', 'Charge refunded', {
            chargeId: ch.id,
            refundId: firstRefund?.id
          });
        }
      }
    }

    // --------- optional: auth voids ---------
    else if (type === 'payment_intent.canceled') {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = await findOrderIdByPI(pi.id);
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: 'REFUNDED', // or 'PENDING' if you consider this before capture
            status: 'CANCELLED',
            canceledAt: new Date(),
            canceledReason: 'Stripe payment intent canceled'
          }
        });
        await logActivity(orderId, 'CANCELLED', 'Stripe payment intent canceled', {
          intentId: pi.id
        });
      }
    }

    // ignore others

    await prisma.webhookEvent.update({
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
