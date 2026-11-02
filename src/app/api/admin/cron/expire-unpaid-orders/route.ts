// src/app/api/admin/cron/expire-unpaid-orders/route.ts
/**
 * Cancels orders that were created but never paid for.
 *
 * placeOrderAndPayWithStripe creates the order BEFORE redirecting to Stripe, so
 * every abandoned checkout leaves a PLACED / PENDING order behind. They clutter
 * the orders list, distort counts, and eventually surface as STALE_ORDER
 * delivery exceptions, which hides real problems among the noise.
 *
 * Deliberately conservative:
 *   - only PLACED + PENDING (never touches anything paid, fulfilled or refunded)
 *   - only orders with no shipment
 *   - only older than ORDER_ABANDON_HOURS (default 24) — long enough that a slow
 *     bank redirect or a customer finishing on another device isn't killed
 *   - cancels rather than deletes, so the record and its history survive
 *
 * Auth: same `x-cron-key` / CRON_SECRET as the other cron route.
 */
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_HOURS = 24;
const MAX_PER_RUN = 200;

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-cron-key');
  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const hours = Number(process.env.ORDER_ABANDON_HOURS ?? DEFAULT_HOURS);
  const safeHours = Number.isFinite(hours) && hours >= 1 ? hours : DEFAULT_HOURS;
  const cutoff = new Date(Date.now() - safeHours * 60 * 60_000);

  // `dry=1` reports what would happen without changing anything.
  const dry = req.nextUrl.searchParams.get('dry') === '1';

  const candidates = await prisma.order.findMany({
    where: {
      status: 'PLACED',
      paymentStatus: 'PENDING',
      createdAt: { lt: cutoff },
      archivedAt: null,
      shipments: { none: {} }
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_PER_RUN,
    select: { id: true, displayId: true, createdAt: true, grandTotal: true }
  });

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      olderThanHours: safeHours,
      wouldCancel: candidates.length,
      orders: candidates.map((o) => o.displayId ?? o.id)
    });
  }

  // Single statement for the status change rather than one UPDATE per order;
  // the activity notes are then written in one createMany.
  const ids = candidates.map((o) => o.id);

  const { count: cancelled } = await prisma.order.updateMany({
    where: { id: { in: ids } },
    data: { status: 'CANCELLED' }
  });

  await prisma.orderActivity
    .createMany({
      data: ids.map((orderId) => ({
        orderId,
        type: 'NOTE' as const,
        note: `Automatically cancelled — no payment received within ${safeHours} hours of checkout.`
      }))
    })
    .catch((e) => console.error('[expire-unpaid-orders] activity log failed', e));

  return NextResponse.json({
    ok: true,
    olderThanHours: safeHours,
    scanned: candidates.length,
    cancelled
  });
}
