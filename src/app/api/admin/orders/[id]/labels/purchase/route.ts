// src/app/api/admin/orders/[id]/labels/purchase/route.ts
import { createAdminNotification } from '@/lib/notify';
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, _ctx: unknown) {
  const { id: orderId } = getParams(_ctx);

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shippingAddress: true }
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    // Simulated purchase:
    const labelUrl = `https://example.com/labels/${order.id}.pdf`;
    const trackingNumber = 'TEST123456789GB';
    const trackingUrl = `https://track.example/${trackingNumber}`;

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: 'Royal Mail',
        service: 'RM48',
        trackingNumber,
        trackingUrl,
        labelUrl,
        status: 'LABEL_READY'
      }
    });

    // ✅ Activity: label purchased
    await Activity.labelPurchased(order.id, {
      carrier: 'Royal Mail',
      service: 'RM48',
      trackingNumber,
      trackingUrl,
      shipmentId: shipment.id,
      labelUrl
    });

    await createAdminNotification({
      kind: 'label_purchased',
      title: `Label purchased for ${order.displayId ?? order.id}`,
      body: `Carrier Royal Mail • Tracking ${trackingNumber}`,
      link: `/admin/orders/${order.id}`
    });

    return NextResponse.json({ ok: true, shipment });
  } catch (err) {
    console.error('Label purchase failed', err);

    await createAdminNotification({
      kind: 'label_failed',
      title: `Label purchase failed for order ${orderId}`,
      body: err instanceof Error ? err.message : String(err),
      link: `/admin/orders/${orderId}`
    });

    // ✅ Activity: note (not "shipment cancelled")
    await Activity.labelFailed(orderId, {
      reason: 'LABEL_PURCHASE_FAILED',
      error: err instanceof Error ? err.message : String(err)
    });

    return NextResponse.json({ ok: false, error: 'LABEL_PURCHASE_FAILED' }, { status: 500 });
  }
}
