// src/app/api/admin/orders/[id]/shipments/apc/send-tracking/route.ts
import { sendTrackingEmail, type ProductTeaser } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderItemForEmail {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  productId: string | null;
  sku: string | null;
}

function mapProductsForEmail(items: OrderItemForEmail[]): ProductTeaser[] {
  return (items ?? []).slice(0, 6).map((it) => {
    const slugOrId = (it.sku ?? it.productId ?? it.id).toString();
    return {
      id: it.productId ?? it.id,
      title: it.name,
      href: `/products/${encodeURIComponent(slugOrId)}`,
      image: it.imageUrl ?? '/assets/prince-foods-logo.png',
      price: Number.isFinite(it.unitPrice) ? it.unitPrice : null
    };
  });
}

function buildTrackingUrl(waybill: string) {
  return `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(
    waybill
  )}`;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const shipment = await prisma.shipment.findFirst({
    where: {
      orderId,
      carrier: { contains: 'APC', mode: 'insensitive' },
      waybill: { not: null }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!shipment?.waybill) {
    return NextResponse.json({ ok: false, error: 'No APC waybill found' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          unitPrice: true,
          productId: true,
          sku: true
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }

  const to = (order.contactEmail ?? '').trim();
  if (!to) {
    return NextResponse.json({ ok: false, error: 'Order has no contact email' }, { status: 400 });
  }

  const waybill = shipment.waybill;
  const trackingUrl = shipment.trackingUrl ?? buildTrackingUrl(waybill);

  await sendTrackingEmail({
    to,
    orderId: order.id,
    displayId: order.displayId ?? order.id,
    carrier: shipment.carrier || 'APC Overnight',
    trackingNumber: shipment.trackingNumber ?? waybill,
    trackingUrl,
    products: mapProductsForEmail(order.items as OrderItemForEmail[])
  });

  await prisma.orderActivity.create({
    data: {
      orderId,
      type: 'NOTE',
      note: `Tracking email sent to ${to} • Waybill ${waybill}`
    }
  });

  return NextResponse.json({ ok: true });
}
