// src/app/api/admin/orders/[id]/returns/[returnId]/reship/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; returnId: string }> }
) {
  const { id: orderId, returnId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as {
    carrier?: string; // default APC Overnight
    note?: string;
  };

  // ✅ No "originalShipment" relation in your schema, so just read what you actually have.
  const rc = await prisma.returnCase.findFirst({
    where: { id: returnId, orderId },
    select: {
      id: true,
      orderId: true,
      shipmentId: true, // treat this as the "original shipment" if set
      meta: true,
      status: true
    }
  });

  if (!rc) return NextResponse.json({ ok: false, error: 'Return case not found' }, { status: 404 });

  const carrier = (body.carrier ?? 'APC Overnight').trim() || 'APC Overnight';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';

  // create new shipment placeholder (no tracking yet)
  // NOTE: keep status casing consistent with your existing shipment flows (you used 'PENDING' elsewhere).
  const newShipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier,
      status: 'PENDING',
      idempotencyKey: `reship_${orderId}_${Date.now()}`
    },
    select: { id: true, carrier: true, status: true, trackingNumber: true, waybill: true }
  });

  // merge into meta safely (meta is Json? in schema)
  const prevMeta =
    rc.meta && typeof rc.meta === 'object' && !Array.isArray(rc.meta)
      ? (rc.meta as Record<string, unknown>)
      : {};

  const updated = await prisma.returnCase.update({
    where: { id: returnId },
    data: {
      // align to your new schema
      status: 'RESOLVED',
      resolution: 'RESHIP',
      resolutionNote: note || undefined,
      resolvedAt: new Date(),

      // attach the new shipment as the active shipment for this return case
      shipmentId: newShipment.id,

      // keep traceability
      meta: {
        ...prevMeta,
        originalShipmentId: rc.shipmentId ?? null,
        reshipShipmentId: newShipment.id,
        carrier
      }
    }
  });

  await Activity.returnReshipCreated(orderId, {
    returnCaseId: returnId,
    carrier,
    reshipShipmentId: newShipment.id,
    originalShipmentId: rc.shipmentId ?? null
  });

  if (note) {
    // keep staff note as NOTE so it’s editable/deletable behaviour remains consistent
    await prisma.orderActivity.create({
      data: { orderId, type: 'NOTE', note }
    });
  }

  return NextResponse.json({ ok: true, returnCase: updated, shipment: newShipment });
}
