// src/app/api/account/orders/[displayId]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Customer-only endpoint.
 * Returns: order + items + addresses + shipments (safe fields) + optional shipment history timeline.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await params;

  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | null)?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const order = await prisma.order.findFirst({
    where: { displayId, userId }, // ✅ ownership enforced
    select: {
      id: true,
      displayId: true,
      status: true,
      paymentStatus: true,
      currency: true,
      subtotal: true,
      shippingTotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,
      totalWeightGrams: true,
      createdAt: true,

      items: {
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          imageUrl: true
        }
      },

      shippingAddress: {
        select: {
          firstName: true,
          lastName: true,
          line1: true,
          line2: true,
          town: true,
          city: true,
          postcode: true,
          country: true,
          phoneE164: true
        }
      },

      billingAddress: {
        select: {
          firstName: true,
          lastName: true,
          line1: true,
          line2: true,
          town: true,
          city: true,
          postcode: true,
          country: true,
          phoneE164: true
        }
      },

      // ✅ Shipments for tracking (NO labelBase64 exposed)
      shipments: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          carrier: true,
          status: true,
          serviceCode: true,
          waybill: true,
          trackingNumber: true,
          trackingUrl: true,
          shippedAt: true,
          createdAt: true,
          updatedAt: true,
          trackingEmailSentAt: true
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }

  // ✅ Optional: build a customer-safe shipment history timeline from OrderActivity
  // We only expose shipping-related types and a small, safe meta subset.
  const activities = await prisma.orderActivity.findMany({
    where: {
      orderId: order.id,
      type: {
        in: [
          'SHIPMENT_CREATED',
          'LABEL_PURCHASED',
          'SHIPMENT_SHIPPED',
          'SHIPMENT_DELIVERED',
          'SHIPMENT_CANCELLED'
        ]
      }
    },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      type: true,
      note: true,
      meta: true
    }
  });

  const history = activities.map((a) => {
    const meta = (a.meta ?? {}) as Record<string, unknown>;

    const shipmentId = typeof meta.shipmentId === 'string' ? meta.shipmentId : null;
    const carrier = typeof meta.carrier === 'string' ? meta.carrier : null;
    const waybill = typeof meta.waybill === 'string' ? meta.waybill : null;
    const trackingUrl = typeof meta.trackingUrl === 'string' ? meta.trackingUrl : null;

    return {
      at: a.createdAt.toISOString(),
      type: a.type,
      note: a.note ?? null,
      shipmentId,
      carrier,
      waybill,
      trackingUrl
    };
  });

  return NextResponse.json({
    ok: true,
    order: {
      ...order,
      createdAt: order.createdAt.toISOString(),
      shipments: order.shipments.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        shippedAt: s.shippedAt ? s.shippedAt.toISOString() : null,
        trackingEmailSentAt: s.trackingEmailSentAt ? s.trackingEmailSentAt.toISOString() : null
      }))
    },
    history
  });
}
