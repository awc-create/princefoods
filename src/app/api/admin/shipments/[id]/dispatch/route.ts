// src/app/api/admin/shipments/[shipmentId]/dispatch/route.ts
import { sendDispatchEmail } from '@/lib/email/send-dispatch-email';
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  // optional override if you want to force-send even if already sent
  forceEmail?: boolean;
  // optional: include label link in email
  includeLabelLink?: boolean;
}

function siteBaseUrl(req: NextRequest): string {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.VERCEL_URL ?? '';

  if (env) {
    const v = env.startsWith('http') ? env : `https://${env}`;
    return v.replace(/\/+$/, '');
  }

  // fallback to request origin
  return new URL(req.url).origin;
}

function buildApcTrackingUrl(waybill: string) {
  return `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(waybill)}`;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      orderId: true,
      carrier: true,
      serviceCode: true,
      waybill: true,
      trackingNumber: true,
      trackingUrl: true,
      status: true,
      shippedAt: true,
      trackingEmailSentAt: true,
      labelMime: true,
      labelBase64: true,
      labelUrl: true,
      order: {
        select: {
          id: true,
          displayId: true,
          contactEmail: true,
          status: true
        }
      }
    }
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: 'Shipment not found' }, { status: 404 });
  }

  // 1) Mark shipment SHIPPED (idempotent)
  const alreadyShipped = shipment.status === 'SHIPPED' || shipment.shippedAt != null;

  const updatedShipment = await prisma.shipment.update({
    where: { id: shipment.id },
    data: {
      status: 'SHIPPED',
      shippedAt: shipment.shippedAt ?? new Date()
    }
  });

  // 2) Activity: shipment shipped (only once)
  if (!alreadyShipped) {
    await Activity.shipmentShipped(shipment.orderId, {
      shipmentId: shipment.id,
      carrier: shipment.carrier,
      serviceCode: shipment.serviceCode,
      waybill: shipment.waybill ?? shipment.trackingNumber ?? null,
      trackingUrl: shipment.trackingUrl ?? null
    });
  }

  // 3) Fulfil order if ALL shipments are shipped
  const all = await prisma.shipment.findMany({
    where: { orderId: shipment.orderId },
    select: { status: true, shippedAt: true }
  });

  const allShipped =
    all.length > 0 && all.every((s) => s.status === 'SHIPPED' || s.shippedAt != null);

  let orderUpdatedToFulfilled = false;

  if (allShipped && shipment.order) {
    const current = shipment.order.status;

    if (current !== 'FULFILLED' && current !== 'CANCELLED' && current !== 'REFUNDED') {
      await prisma.order.update({
        where: { id: shipment.orderId },
        data: { status: 'FULFILLED' }
      });

      await Activity.fulfilled(shipment.orderId, {
        reason: 'ALL_SHIPMENTS_SHIPPED',
        shipmentsCount: all.length
      });

      orderUpdatedToFulfilled = true;
    }
  }

  // 4) Send customer email (once per shipment unless forceEmail)
  const emailAlreadySent = shipment.trackingEmailSentAt != null;
  const shouldSendEmail =
    Boolean(shipment.order?.contactEmail) && (!emailAlreadySent || Boolean(body.forceEmail));

  let emailSent = false;

  if (shouldSendEmail) {
    const waybill = shipment.waybill ?? shipment.trackingNumber ?? '';
    const trackingUrl = shipment.trackingUrl ?? (waybill ? buildApcTrackingUrl(waybill) : '');

    const base = siteBaseUrl(req);
    const labelLink = body.includeLabelLink
      ? `${base}/api/admin/shipments/${shipment.id}/label?download=1`
      : undefined;

    await sendDispatchEmail({
      to: shipment.order!.contactEmail,
      orderId: shipment.order!.id,
      orderDisplayId: shipment.order!.displayId,
      carrier: shipment.carrier,
      waybill,
      trackingUrl,
      labelUrl: labelLink
    });

    await prisma.shipment.update({
      where: { id: shipment.id },
      data: { trackingEmailSentAt: new Date() }
    });

    emailSent = true;
  }

  return NextResponse.json({
    ok: true,
    shipment: updatedShipment,
    allShipped,
    orderUpdatedToFulfilled,
    emailSent
  });
}
