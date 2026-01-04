import { sendTrackingEmail, type ProductTeaser } from '@/lib/email';
import { createAdminNotification } from '@/lib/notify';
import { prisma } from '@/lib/prisma';
import { getLabelWithPolling } from '@/lib/shipping/apc';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OrderItemForEmail {
  id: string;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  productId: string | null;
}

function mapProductsForEmail(items: OrderItemForEmail[]): ProductTeaser[] {
  return (items ?? []).slice(0, 6).map((it) => ({
    id: it.productId ?? it.id,
    title: it.name,
    href: `/products/${encodeURIComponent(it.productId ?? it.id)}`,
    image: it.imageUrl ?? '/assets/prince-foods-logo.png',
    price: Number.isFinite(it.unitPrice) ? it.unitPrice : null
  }));
}

function guessMimeFromBase64(base64: string) {
  if (base64.startsWith('JVBERi0')) return 'application/pdf';
  return 'application/octet-stream';
}

function buildTrackingUrl(waybill: string) {
  return `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(waybill)}`;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const shipment = await prisma.shipment.findFirst({
    where: {
      orderId,
      carrier: { contains: 'APC', mode: 'insensitive' },
      waybill: { not: null }
    },
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          id: true,
          displayId: true,
          contactEmail: true,
          items: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              unitPrice: true,
              productId: true
            }
          }
        }
      }
    }
  });

  if (!shipment) {
    return NextResponse.json(
      { ok: false, error: 'No APC shipment found for this order' },
      { status: 404 }
    );
  }

  const waybill = shipment.waybill!;
  try {
    const label = await getLabelWithPolling(waybill, {
      delayMs: Number(process.env.APC_LABEL_DELAY_MS ?? 1500),
      attempts: Number(process.env.APC_LABEL_RETRY_MANUAL ?? 12)
    });

    const trackingUrl = shipment.trackingUrl ?? buildTrackingUrl(waybill);
    const mime = label.mime ?? guessMimeFromBase64(label.base64);

    const updated = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        labelMime: mime,
        labelBase64: label.base64,
        status: 'LABEL_READY',
        trackingNumber: shipment.trackingNumber ?? waybill,
        trackingUrl
      }
    });

    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'NOTE',
        note: `APC label ready (manual retry) • Waybill ${waybill}`
      }
    });

    await createAdminNotification({
      kind: 'label_ready',
      title: `APC label ready for ${shipment.order.displayId ?? shipment.order.id}`,
      body: `Waybill ${waybill}`,
      link: `/admin/orders/${shipment.order.id}`
    });

    // Send tracking email once
    const to = (shipment.order.contactEmail ?? '').trim();
    if (to && !updated.trackingEmailSentAt) {
      await sendTrackingEmail({
        to,
        orderId: shipment.order.id,
        displayId: shipment.order.displayId ?? shipment.order.id,
        carrier: shipment.carrier || 'APC Overnight',
        trackingNumber: updated.trackingNumber ?? waybill,
        trackingUrl: updated.trackingUrl ?? trackingUrl,
        products: mapProductsForEmail(shipment.order.items)
      });

      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { trackingEmailSentAt: new Date() }
      });
    }

    return NextResponse.json({ ok: true, status: 'READY', waybill, trackingUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: true, status: 'PENDING', waybill, message: msg },
      { status: 202 }
    );
  }
}
