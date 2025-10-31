// src/app/api/admin/orders/[id]/revert-cancel/route.ts
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 60 seconds of grace for tiny clock skews between server/client
const GRACE_MS = 60_000;

function toEpochMs(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  if (d instanceof Date) return d.getTime();
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function POST(_req: NextRequest, _ctx: unknown) {
  try {
    const { id: orderId } = getParams<{ id: string }>(_ctx);

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        editableUntil: true,
        cancelReversibleUntil: true,
        refundTotal: true
      }
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    // Take whichever field is set (new first, then legacy)
    const untilRaw = order.cancelReversibleUntil ?? order.editableUntil;
    const untilMs = toEpochMs(untilRaw);

    if (!untilMs) {
      return NextResponse.json(
        { ok: false, error: 'No reversal deadline on this order' },
        { status: 400 }
      );
    }

    const now = Date.now();
    if (untilMs + GRACE_MS < now) {
      return NextResponse.json({ ok: false, error: 'Reversal window ended' }, { status: 400 });
    }

    if ((order.refundTotal ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, error: 'Cannot revert after a refund' },
        { status: 400 }
      );
    }

    if (order.status !== 'CANCELLED') {
      return NextResponse.json({ ok: false, error: 'Order is not cancelled' }, { status: 400 });
    }

    // restore to the right status based on paymentStatus at time of cancel
    const restoreStatus = order.paymentStatus === 'CAPTURED' ? 'PAID' : 'PLACED';
    const nowDate = new Date();

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: restoreStatus,
        // clear cancel markers
        canceledAt: null,
        canceledReason: null,
        editableUntil: null,
        cancelReversibleUntil: null,
        cancelReversedAt: nowDate,
        cancelReversalReason: 'Reverted within window'
      }
    });

    await logActivity(orderId, restoreStatus, 'Cancellation reverted within window');

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'REVERT_CANCEL_FAILED' }, { status: 500 });
  }
}
