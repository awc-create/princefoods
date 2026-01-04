// src/app/api/admin/orders/%5Bid%5D/cancel/route.ts
import { computeReversalUntil } from '@/lib/cancel-window';
import { sendOrderCancelledEmail, sendRefundEmail } from '@/lib/email';
import { createAdminNotification } from '@/lib/notify';
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Mode = 'CANCEL_ONLY' | 'FULL_REFUND' | 'PARTIAL_REFUND' | 'MARK_REFUNDED_EXTERNALLY';

export async function POST(req: NextRequest, _ctx: unknown) {
  const { id: orderId } = getParams(_ctx);

  try {
    const body = (await req.json()) as { reason?: string; mode?: Mode; amountPence?: number };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true }
    });
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

    if (order.status === 'FULFILLED') {
      return NextResponse.json({ ok: false, error: 'Order already fulfilled' }, { status: 400 });
    }

    const reasonNote = (body.reason ?? '').trim() || undefined;

    // Stripe state
    const isTest =
      order.paymentProvider === 'stripe_test' ||
      order.payments.some((p) => (p.idempotencyKey ?? '').includes('test'));
    const captured = order.payments.filter(
      (p) => p.status === 'CAPTURED' && (p.provider ?? '').includes('stripe')
    );
    const hasStripeCapture = captured.length > 0;
    const remaining = Math.max(0, (order.grandTotal ?? 0) - (order.refundTotal ?? 0));

    // Choose final mode
    let mode: Mode = body.mode ?? 'CANCEL_ONLY';
    if (!hasStripeCapture || isTest || remaining === 0) {
      if (mode === 'FULL_REFUND' || mode === 'PARTIAL_REFUND') mode = 'CANCEL_ONLY';
    }

    // Validate partial
    let partial = 0;
    if (mode === 'PARTIAL_REFUND') {
      const n = Number(body.amountPence);
      if (!Number.isFinite(n) || n <= 0) {
        return NextResponse.json({ ok: false, error: 'Invalid partial amount' }, { status: 400 });
      }
      if (n > remaining) {
        return NextResponse.json(
          { ok: false, error: 'Amount exceeds remaining balance' },
          { status: 400 }
        );
      }
      partial = Math.floor(n);
    }

    // Reversal window
    const editableUntil = await computeReversalUntil();
    const now = new Date();

    // Stripe refund
    if (!isTest && hasStripeCapture && (mode === 'FULL_REFUND' || mode === 'PARTIAL_REFUND')) {
      const secret = process.env.STRIPE_SECRET_KEY?.trim();
      if (!secret) {
        return NextResponse.json({ ok: false, error: 'Stripe not configured' }, { status: 500 });
      }
      const stripe = new Stripe(secret);

      const piId = order.paymentIntentId ?? captured[0]?.intentId ?? null;
      if (!piId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            status: 'CANCELLED',
            paymentStatus: order.paymentStatus,
            canceledAt: now,
            canceledReason: reasonNote ?? 'Cancelled (no PI located)',
            editableUntil,
            cancellationRequestedAt: now,
            cancelReversibleUntil: editableUntil
          }
        });
        await logActivity(orderId, 'CANCELLED', reasonNote ?? 'Cancelled (no PI located)');

        await createAdminNotification({
          kind: 'order_cancelled',
          title: `Order ${order.displayId ?? orderId} cancelled`,
          body: reasonNote ?? undefined,
          link: `/admin/orders/${orderId}`
        });
        if (order.contactEmail) {
          await sendOrderCancelledEmail({
            to: order.contactEmail,
            orderId,
            displayId: order.displayId,
            reason: reasonNote
          });
        }

        return NextResponse.json({ ok: true, mode: 'cancel-only', editableUntil });
      }

      const amountToRefund = mode === 'FULL_REFUND' ? remaining : partial;

      const refund = await stripe.refunds.create({
        payment_intent: piId,
        amount: amountToRefund
      });

      const newRefundTotal = (order.refundTotal ?? 0) + amountToRefund;
      const fullyRefunded = newRefundTotal >= (order.grandTotal ?? 0);

      await prisma.order.update({
        where: { id: orderId },
        data: {
          refundTotal: { increment: amountToRefund },
          status: fullyRefunded ? 'CANCELLED' : 'REFUNDED',
          paymentStatus: fullyRefunded ? 'REFUNDED' : 'PARTIAL_REFUND',
          canceledAt: fullyRefunded ? now : (order.canceledAt ?? now),
          canceledReason:
            reasonNote ??
            (mode === 'FULL_REFUND'
              ? 'Full refund at cancellation'
              : `Partial refund at cancellation (£${(amountToRefund / 100).toFixed(2)})`),
          editableUntil,
          cancellationRequestedAt: now,
          cancelReversibleUntil: editableUntil,
          refundExecutedAt: now,
          refundAmountPence: amountToRefund,
          refundId: refund.id
        }
      });

      await prisma.payment.create({
        data: {
          orderId,
          provider: 'stripe',
          refundId: refund.id,
          amountPence: -amountToRefund,
          currency: (refund.currency ?? 'gbp').toUpperCase(),
          status: 'REFUNDED'
        }
      });

      await logActivity(
        orderId,
        fullyRefunded ? 'CANCELLED' : 'REFUNDED',
        reasonNote ??
          (mode === 'FULL_REFUND'
            ? 'Full refund at cancellation'
            : `Partial refund at cancellation (£${(amountToRefund / 100).toFixed(2)})`),
        { stripeRefundId: refund.id, amountPence: amountToRefund }
      );

      // Notify + Email
      await createAdminNotification({
        kind: 'order_refund',
        title: `Refund issued for order ${order.displayId ?? orderId}`,
        body: `Amount £${(amountToRefund / 100).toFixed(2)} refunded.`,
        link: `/admin/orders/${orderId}`
      });

      if (order.contactEmail) {
        await sendRefundEmail({
          to: order.contactEmail,
          orderId,
          displayId: order.displayId,
          amountPence: amountToRefund
        });
      }

      return NextResponse.json({
        ok: true,
        mode: 'stripe-refund',
        refundedPence: amountToRefund,
        editableUntil
      });
    }

    // Manual refund
    if (mode === 'MARK_REFUNDED_EXTERNALLY') {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'REFUNDED',
          canceledAt: now,
          canceledReason: reasonNote ?? 'Cancelled; refund handled externally',
          editableUntil,
          cancellationRequestedAt: now,
          cancelReversibleUntil: editableUntil,
          refundExecutedAt: now,
          refundAmountPence: remaining,
          refundId: null
        }
      });

      if (remaining > 0) {
        await prisma.payment.create({
          data: {
            orderId,
            provider: 'external',
            amountPence: -remaining,
            currency: (order.currency ?? 'GBP').toUpperCase(),
            status: 'REFUNDED'
          }
        });
      }

      await logActivity(
        orderId,
        'CANCELLED',
        reasonNote ?? 'Marked refunded externally on cancel',
        {
          amountPence: remaining
        }
      );

      await createAdminNotification({
        kind: 'order_refund_manual',
        title: `Manual refund recorded for ${order.displayId ?? orderId}`,
        body: reasonNote ?? undefined,
        link: `/admin/orders/${orderId}`
      });

      if (order.contactEmail) {
        await sendOrderCancelledEmail({
          to: order.contactEmail,
          orderId,
          displayId: order.displayId,
          reason: reasonNote
        });
      }

      return NextResponse.json({ ok: true, mode: 'manual-refund', editableUntil });
    }

    // Cancel only
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        canceledAt: now,
        canceledReason: reasonNote ?? 'Cancelled without card refund',
        editableUntil,
        cancellationRequestedAt: now,
        cancelReversibleUntil: editableUntil
      }
    });

    await logActivity(orderId, 'CANCELLED', reasonNote ?? 'Cancelled without card refund');

    await createAdminNotification({
      kind: 'order_cancelled',
      title: `Order ${order.displayId ?? orderId} cancelled`,
      body: reasonNote ?? null,
      link: `/admin/orders/${orderId}`
    });

    if (order.contactEmail) {
      await sendOrderCancelledEmail({
        to: order.contactEmail,
        orderId,
        displayId: order.displayId,
        reason: reasonNote
      });
    }

    return NextResponse.json({ ok: true, mode: 'cancel-only', editableUntil });
  } catch (err) {
    console.error('Cancel route failed', err);
    await createAdminNotification({
      kind: 'order_cancel_failed',
      title: `Order cancel failed`,
      body: String(err),
      link: `/admin/orders/${orderId}`
    });
    return NextResponse.json({ ok: false, error: 'CANCEL_FAILED' }, { status: 500 });
  }
}
