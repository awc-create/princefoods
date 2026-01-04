// src/app/api/admin/orders/[id]/track/apc/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { apcGetOrderByWaybill } from '@/lib/shipping/apc';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: unknown) {
  const { id: orderId } = getParams(ctx);

  const shipment = await prisma.shipment.findFirst({
    where: { orderId, carrier: { contains: 'APC', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' }
  });

  const waybill = shipment?.trackingNumber ?? shipment?.waybill ?? null;

  if (!waybill) {
    return NextResponse.json({ ok: false, error: 'No APC waybill on order' }, { status: 400 });
  }

  const data = await apcGetOrderByWaybill(waybill);

  // Optional: persist raw tracking payload
  // await prisma.shipment.update({
  //   where: { id: shipment!.id },
  //   data: { trackingEvents: data }
  // });

  return NextResponse.json({ ok: true, data });
}
