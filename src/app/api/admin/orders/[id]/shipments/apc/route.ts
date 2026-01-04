// src/app/api/admin/orders/[id]/shipments/apc/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const shipment = await prisma.shipment.findFirst({
    where: { orderId, carrier: { contains: 'APC', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' }
  });

  if (!shipment) return NextResponse.json({ ok: true, shipment: null });

  return NextResponse.json({
    ok: true,
    shipment: {
      id: shipment.id,
      carrier: shipment.carrier,
      status: shipment.status,
      waybill: shipment.waybill,
      trackingNumber: shipment.trackingNumber,
      trackingUrl: shipment.trackingUrl,
      labelMime: shipment.labelMime,
      hasLabel: !!(shipment.labelBase64 && shipment.labelBase64.length > 20),
      trackingEmailSentAt: shipment.trackingEmailSentAt
        ? shipment.trackingEmailSentAt.toISOString()
        : null,
      updatedAt: shipment.updatedAt.toISOString()
    }
  });
}
