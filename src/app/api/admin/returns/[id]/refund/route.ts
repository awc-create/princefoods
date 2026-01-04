import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: unknown) {
  const { id } = getParams<{ id: string }>(ctx);

  try {
    const body = (await req.json()) as {
      amountPence?: number; // default remaining
      note?: string;
      external?: boolean; // mark externally
    };

    const rc = await prisma.returnCase.findUnique({
      where: { id },
      include: { order: { include: { payments: true } } }
    });
    if (!rc) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    const order = rc.order;
    const note = (body.note ?? '').trim().slice(0, 2000) || null;

    const captured = order.payments.filter(
      (p) => p.status === 'CAPTURED' && p.provider.includes('stripe')
    );
    const hasStripeCapture = captured.length > 0;

    const remaining = Math.max(0, (order.grandTotal ?? 0) - (order.refundTotal ?? 0));
    const amount = Math.max(
      0,
      Math.min(remaining, Math.floor(Number(body.amountPence ?? remaining)))
    );

    if (amount <= 0) {
      return NextResponse.json({ ok: false, error: 'NOTHING_TO_REFUND' }, { status: 400 });
    }

    const isTest =
      order.paymentProvider === 'stripe_test' ||
      order.payments.some((p) => (p.idempotencyKey ?? '').includes('test'));

    // Stripe refund if allowed
    if (!body.external && !isTest && hasStripeCapture) {
      const secret = process.env.STRIPE_SECRET_KEY?.trim();
      if (!secret) return NextResponse.json({ ok: false, error: 'NO_STRIPE_KEY' }, { status: 500 });

      const stripe = new Stripe(secret);
      const piId = order.paymentIntentId ?? captured[0]?.intentId ?? null;
      if (!piId)
        return NextResponse.json({ ok: false, error: 'NO_PAYMENT_INTENT' }, { status: 400 });

      const refund = await stripe.refunds.create({
        payment_intent: piId,
        amount
      });

      await prisma.order.update({
        where: { id: order.id },
        data: {
          refundTotal: { increment: amount },
          paymentStatus: amount === remaining ? 'REFUNDED' : 'PARTIAL_REFUND',
          status: amount === remaining ? 'CANCELLED' : 'REFUNDED',
          refundExecutedAt: new Date(),
          refundAmountPence: amount,
          refundId: refund.id
        }
      });

      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: 'stripe',
          refundId: refund.id,
          amountPence: -amount,
          currency: (refund.currency ?? 'gbp').toUpperCase(),
          status: 'REFUNDED'
        }
      });

      await prisma.returnCase.update({
        where: { id },
        data: {
          resolution: 'REFUND',
          resolutionNote: note,
          status: 'RESOLVED',
          resolvedAt: new Date(),
          meta: { ...(rc.meta as object), stripeRefundId: refund.id, amountPence: amount }
        }
      });

      await prisma.orderActivity.create({
        data: {
          orderId: order.id,
          type: 'RETURN_DECIDED_REFUND',
          note: note ?? `Refund issued (£${(amount / 100).toFixed(2)})`,
          meta: { returnCaseId: id, stripeRefundId: refund.id, amountPence: amount }
        }
      });

      return NextResponse.json({
        ok: true,
        mode: 'stripe',
        refundId: refund.id,
        amountPence: amount
      });
    }

    // External/manual refund record
    await prisma.order.update({
      where: { id: order.id },
      data: {
        refundTotal: { increment: amount },
        paymentStatus: amount === remaining ? 'REFUNDED' : 'PARTIAL_REFUND',
        status: amount === remaining ? 'CANCELLED' : 'REFUNDED',
        refundExecutedAt: new Date(),
        refundAmountPence: amount,
        refundId: null
      }
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'external',
        amountPence: -amount,
        currency: (order.currency ?? 'GBP').toUpperCase(),
        status: 'REFUNDED'
      }
    });

    await prisma.returnCase.update({
      where: { id },
      data: {
        resolution: 'REFUND',
        resolutionNote: note ?? 'Refund handled externally',
        status: 'RESOLVED',
        resolvedAt: new Date(),
        meta: { ...(rc.meta as object), externalRefund: true, amountPence: amount }
      }
    });

    await prisma.orderActivity.create({
      data: {
        orderId: order.id,
        type: 'RETURN_DECIDED_REFUND',
        note: note ?? `Refund recorded externally (£${(amount / 100).toFixed(2)})`,
        meta: { returnCaseId: id, externalRefund: true, amountPence: amount }
      }
    });

    return NextResponse.json({ ok: true, mode: 'external', amountPence: amount });
  } catch (e) {
    console.error('POST /api/admin/returns/[id]/refund failed', e);
    return NextResponse.json({ ok: false, error: 'RETURNS_REFUND_FAILED' }, { status: 500 });
  }
}
