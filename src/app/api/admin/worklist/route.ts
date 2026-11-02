// src/app/api/admin/worklist/route.ts
/**
 * "What needs doing right now" — one call, all counts.
 *
 * The dashboard previously showed Products / Customers / Orders / Revenue: useful
 * to the owner, useless to someone logging in to pack orders. This powers a work
 * queue instead, so the first screen answers "where do I start?".
 *
 * Counts only (no rows), run in parallel, so it stays fast as data grows.
 */
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const [toPack, labelsToPrint, openReturns, customerReports, unpaidStale] = await Promise.all([
      // Paid, not yet shipped — the core packing queue.
      prisma.order.count({
        where: {
          status: 'PAID',
          archivedAt: null,
          shipments: { none: { voidedAt: null } }
        }
      }),

      // Label bought but the customer hasn't been told yet.
      prisma.shipment.count({
        where: {
          voidedAt: null,
          dispatchedAt: null,
          OR: [{ labelUrl: { not: null } }, { labelBase64: { not: null } }]
        }
      }),

      prisma.returnCase.count({ where: { status: 'OPEN' } }),

      // Raised by a customer via "Report a problem" rather than detected by us.
      prisma.returnCase.count({
        where: { status: 'OPEN', meta: { path: ['source'], equals: 'customer' } }
      }),

      // Checkout started, never paid — clutters the list until the cron clears it.
      prisma.order.count({
        where: {
          status: 'PLACED',
          paymentStatus: 'PENDING',
          archivedAt: null,
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60_000) }
        }
      })
    ]);

    return NextResponse.json(
      {
        ok: true,
        toPack,
        labelsToPrint,
        openReturns,
        customerReports,
        unpaidStale
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('[worklist]', e);
    // The dashboard degrades to "—" rather than showing misleading zeros.
    return NextResponse.json({ ok: false, error: 'Could not load the work list.' }, { status: 500 });
  }
}
