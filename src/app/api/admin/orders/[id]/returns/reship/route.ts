import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };

  // ensure order exists
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, displayId: true, status: true }
  });

  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  // create a new shipment placeholder (label will be bought via existing flow)
  const shipment = await prisma.shipment.create({
    data: {
      orderId,
      carrier: 'APC',
      status: 'PENDING',
      idempotencyKey: `reship_${orderId}_${Date.now()}`
    },
    select: { id: true }
  });

  // update/resolve return case to RESHIP
  const rc = await prisma.returnCase.upsert({
    where: { orderId },
    update: {
      status: 'RESOLVED',
      resolution: 'RESHIP',
      resolutionNote: body.note ?? undefined,
      resolvedAt: new Date(),
      shipmentId: shipment.id
    },
    create: {
      orderId,
      status: 'RESOLVED',
      resolution: 'RESHIP',
      resolutionNote: body.note ?? undefined,
      resolvedAt: new Date(),
      shipmentId: shipment.id
    }
  });

  await prisma.orderActivity.create({
    data: {
      orderId,
      type: 'NOTE',
      note: body.note ? `Reship created: ${body.note}` : 'Reship created',
      meta: { action: 'RESHIP', returnCaseId: rc.id, newShipmentId: shipment.id }
    }
  });

  return NextResponse.json({ ok: true, newShipmentId: shipment.id });
}
