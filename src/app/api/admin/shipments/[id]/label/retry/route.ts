// src/app/api/admin/shipments/[shipmentId]/label/retry/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getLabelWithPolling } from '@/lib/shipping/apc';
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
      labelBase64: true,
      labelUrl: true,
      labelMime: true,
      status: true
    }
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: 'Shipment not found' }, { status: 404 });
  }

  const waybill = shipment.waybill ?? shipment.trackingNumber;
  if (!waybill) {
    return NextResponse.json(
      { ok: false, error: 'Shipment has no waybill/tracking number' },
      { status: 400 }
    );
  }

  // If label already exists, just return it
  if (shipment.labelBase64 || shipment.labelUrl) {
    return NextResponse.json({
      ok: true,
      status: shipment.labelBase64 || shipment.labelUrl ? 'LABEL_READY' : shipment.status,
      shipment
    });
  }

  try {
    const label = await getLabelWithPolling(waybill, {
      delayMs: Number(process.env.APC_LABEL_DELAY_MS ?? 3500),
      attempts: Number(process.env.APC_LABEL_RETRY ?? 40)
    });

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        labelMime: label.mime ?? 'application/pdf',
        labelBase64: label.base64 ?? null,
        status: 'LABEL_READY'
      }
    });

    // record activity (uses method that already exists in your Activity wrapper)
    await Activity.labelPurchased(shipment.orderId, {
      carrier: shipment.carrier,
      waybill,
      shipmentId: shipment.id,
      labelMime: label.mime ?? 'application/pdf',
      retry: true
    });

    return NextResponse.json({ ok: true, shipment: updated, label });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to fetch label' },
      { status: 502 }
    );
  }
}
