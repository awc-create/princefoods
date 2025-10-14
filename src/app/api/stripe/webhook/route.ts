import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Raw body for signature verification
async function rawBody(req: NextRequest): Promise<string> {
  return await req.text();
}

// Accept either internal id or displayId
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

  // same label everywhere
  const providerLabel = event.livemode ? 'stripe' : 'test';

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        const orderId = await findOrderByIdOrDisplay(session.client_reference_id);
        if (!orderId) break;

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
            paymentProvider: providerLabel, // 👈 mark live/test
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
        break;
      }

      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;

        // prefer explicit metadata
        let orderId = await findOrderByIdOrDisplay(pi.metadata?.orderId);
        orderId ??= await findOrderByIdOrDisplay(pi.metadata?.displayId);
        if (!orderId) break;

        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'CAPTURED',
            paymentProvider: providerLabel, // 👈 mark live/test
            paymentIntentId: pi.id
          }
        });

        const existing = await prisma.payment.findFirst({ where: { intentId: pi.id } });
        if (existing) {
          await prisma.payment.update({
            where: { id: existing.id },
            data: {
              amountPence: pi.amount_received ?? pi.amount ?? existing.amountPence,
              status: 'CAPTURED'
            }
          });
        } else {
          await prisma.payment.create({
            data: {
              orderId,
              provider: 'stripe',
              intentId: pi.id,
              chargeId: null,
              amountPence: pi.amount_received ?? pi.amount ?? 0,
              currency: (pi.currency ?? 'gbp').toUpperCase(),
              status: 'CAPTURED'
            }
          });
        }
        break;
      }

      case 'charge.refunded': {
        const ch = event.data.object as Stripe.Charge;
        const pay = await prisma.payment.findFirst({ where: { chargeId: ch.id } });
        if (pay) {
          await prisma.payment.update({
            where: { id: pay.id },
            data: { status: 'REFUNDED', refundId: ch.refunds?.data?.[0]?.id ?? pay.refundId }
          });
          await prisma.order.update({
            where: { id: pay.orderId },
            data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' }
          });
        }
        break;
      }

      default:
        // ignore
        break;
    }

    await prisma.webhookEvent.update({
      where: { eventId: event.id },
      data: { processedAt: new Date(), success: true }
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Processing error';
    await prisma.webhookEvent.updateMany({
      where: { eventId: (event as Stripe.Event).id },
      data: { processedAt: new Date(), success: false, error: msg }
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
