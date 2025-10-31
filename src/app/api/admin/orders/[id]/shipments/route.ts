import { sendTrackingEmail } from '@/lib/email';
import { createAdminNotification } from '@/lib/notify';
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx'; // helper for safe param extraction
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, _ctx: unknown) {
  try {
    const { id: orderId } = getParams<{ id: string }>(_ctx);

    const body = (await req.json()) as {
      carrier: string;
      trackingNumber: string;
      trackingUrl?: string | null;
      weightGrams?: number | null;
      emailCustomer?: boolean;
      markFulfilled?: boolean;
    };

    const carrier = (body.carrier ?? '').trim();
    const trackingNumber = (body.trackingNumber ?? '').trim();

    if (!carrier || !trackingNumber) {
      return NextResponse.json(
        { ok: false, error: 'Carrier and tracking number required' },
        { status: 400 }
      );
    }

    // Prefer supplied URL; otherwise build a simple APC Overnight URL as fallback
    const trackingUrl =
      (body.trackingUrl ?? '').trim() ||
      (carrier === 'APC Overnight'
        ? `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(
            trackingNumber
          )}`
        : null);

    // Make sure order exists (and read email + status)
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, displayId: true, contactEmail: true, status: true }
    });

    if (!order) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // Create shipment record
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier,
        trackingNumber,
        trackingUrl,
        weightGrams: body.weightGrams ? Math.floor(body.weightGrams) : null,
        status: 'shipped',
        shippedAt: new Date()
      }
    });

    // Optionally mark order fulfilled
    if (body.markFulfilled) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'FULFILLED' }
      });
    }

    // Optionally email customer
    let emailed = false;
    if (body.emailCustomer === true && order.contactEmail) {
      await sendTrackingEmail({
        to: order.contactEmail,
        orderId: order.id,
        displayId: order.displayId,
        carrier,
        trackingNumber,
        trackingUrl: trackingUrl ?? undefined
      });
      emailed = true;
    }

    // Record activity
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'NOTE',
        note: `Shipment added (${carrier} ${trackingNumber})${emailed ? ' + emailed customer' : ''}`
      }
    });

    // Admin notification
    await createAdminNotification({
      kind: 'shipment_created',
      title: `Shipment created for ${order.displayId ?? order.id}`,
      body: `${carrier} • ${trackingNumber}${emailed ? ' • customer emailed' : ''}`,
      link: `/admin/orders/${order.id}`
    });

    return NextResponse.json({ ok: true, shipment, emailed });
  } catch (error) {
    console.error('Create shipment failed:', error);
    return NextResponse.json({ ok: false, error: 'SHIPMENT_FAILED' }, { status: 500 });
  }
}
