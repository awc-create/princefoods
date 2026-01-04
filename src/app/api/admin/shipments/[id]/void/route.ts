// src/app/api/admin/shipments/[shipmentId]/void/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await ctx.params;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      orderId: true,
      carrier: true,
      waybill: true,
      trackingNumber: true,
      trackingUrl: true,
      status: true,
      shippedAt: true
    }
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: 'Shipment not found' }, { status: 404 });
  }

  // ✅ Idempotent: already cancelled
  if (shipment.status === 'CANCELLED') {
    return NextResponse.json({ ok: true, shipment });
  }

  // If it’s already shipped/delivered you may want to block voiding
  const effectivelyShipped =
    shipment.status === 'SHIPPED' || shipment.status === 'DELIVERED' || shipment.shippedAt != null;

  if (effectivelyShipped) {
    return NextResponse.json(
      { ok: false, error: `Cannot void a shipment with status ${shipment.status}` },
      { status: 400 }
    );
  }

  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: { status: 'CANCELLED' }
  });

  // ✅ Use existing Activity method
  await Activity.shipmentCancelled(shipment.orderId, {
    carrier: shipment.carrier,
    waybill: shipment.waybill ?? shipment.trackingNumber ?? null,
    trackingUrl: shipment.trackingUrl ?? null,
    shipmentId: shipment.id,
    reason: 'voided_by_admin'
  });

  return NextResponse.json({ ok: true, shipment: updated });
}
