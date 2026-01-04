// src/app/api/admin/orders/[id]/returns/open/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Align to your NEW schema enum: DeliveryIssueType
type DeliveryIssueType =
  | 'DELIVERY_FAILED'
  | 'RETURN_TO_DEPOT'
  | 'RETURN_TO_SENDER'
  | 'LOST'
  | 'DAMAGED'
  | 'UNKNOWN';

function asIssueType(v: unknown): DeliveryIssueType {
  const s = typeof v === 'string' ? v : 'UNKNOWN';
  const allowed = new Set<DeliveryIssueType>([
    'DELIVERY_FAILED',
    'RETURN_TO_DEPOT',
    'RETURN_TO_SENDER',
    'LOST',
    'DAMAGED',
    'UNKNOWN'
  ]);
  return allowed.has(s as DeliveryIssueType) ? (s as DeliveryIssueType) : 'UNKNOWN';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    issueType?: string; // prefer this name going forward
    reason?: string; // still accept old name from client
    note?: string;
    originalShipmentId?: string | null;
  };

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  // Accept either issueType or reason (backwards compatibility)
  const issueType = asIssueType(body.issueType ?? body.reason);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';

  // shipmentId: prefer provided, else latest APC-ish shipment, else null
  const providedShipmentId = body.originalShipmentId ?? undefined;

  const latestShipmentId =
    (
      await prisma.shipment.findFirst({
        where: { orderId, carrier: { contains: 'APC', mode: 'insensitive' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true }
      })
    )?.id ?? undefined;

  const shipmentId: string | null = providedShipmentId ?? latestShipmentId ?? null;

  // If an OPEN-ish case already exists, return it (avoid duplicates)
  // ✅ FIX: remove IN_TRANSIT (not in enum)
  const existing = await prisma.returnCase.findFirst({
    where: { orderId, status: { in: ['OPEN', 'RECEIVED'] } },
    orderBy: { createdAt: 'desc' }
  });
  if (existing) return NextResponse.json({ ok: true, returnCase: existing });

  const created = await prisma.returnCase.create({
    data: {
      orderId,
      shipmentId,
      status: 'OPEN',
      issueType,
      detectedAt: new Date(),
      resolutionNote: note || undefined,
      meta: {
        openedBy: 'admin',
        // keep any extra context for later
        originalShipmentId: shipmentId,
        note: note || undefined
      }
    }
  });

  // typed activity
  await Activity.returnOpened(orderId, note || null, {
    returnCaseId: created.id,
    reason: issueType, // if your Activity expects "reason", pass issueType
    originalShipmentId: shipmentId
  });

  return NextResponse.json({ ok: true, returnCase: created });
}
