// src/app/api/orders/[displayId]/tracking/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildApcTrackingUrl(waybill: string) {
  return `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(waybill)}`;
}

// Keep it minimal + safe: only return shipping-relevant activity types
const SHIPPING_ACTIVITY = new Set([
  'SHIPMENT_CREATED',
  'LABEL_PURCHASED',
  'SHIPMENT_SHIPPED',
  'SHIPMENT_DELIVERED',
  'SHIPMENT_CANCELLED'
]);

interface HistoryEvent {
  at: Date;
  type: string;
  note: string | null;
  shipmentId: string | null;
  carrier: string | null;
  waybill: string | null;
  trackingUrl: string | null;
}

function normaliseHistory(
  rows: Array<{ type: string; note: string | null; meta: unknown; createdAt: Date }>
) {
  const out: HistoryEvent[] = [];

  for (const r of rows) {
    if (!SHIPPING_ACTIVITY.has(r.type)) continue;

    const meta = (r.meta ?? null) as Record<string, unknown> | null;

    const shipmentId = typeof meta?.shipmentId === 'string' ? meta.shipmentId : null;
    const carrier = typeof meta?.carrier === 'string' ? meta.carrier : null;
    const waybill = typeof meta?.waybill === 'string' ? meta.waybill : null;

    const trackingUrl =
      typeof meta?.trackingUrl === 'string'
        ? meta.trackingUrl
        : waybill
          ? buildApcTrackingUrl(waybill)
          : null;

    out.push({
      at: r.createdAt,
      type: r.type,
      note: r.note ?? null,
      shipmentId,
      carrier,
      waybill,
      trackingUrl
    });
  }

  // newest first
  out.sort((a, b) => b.at.getTime() - a.at.getTime());
  return out;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ displayId: string }> }) {
  const { displayId } = await ctx.params;

  const url = new URL(req.url);
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();

  // ✅ Require email (don’t allow “guessable displayId” tracking)
  if (!email) {
    return NextResponse.json({ ok: false, error: 'Missing email' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { displayId },
    select: {
      id: true,
      displayId: true,
      contactEmail: true,
      status: true,
      createdAt: true,
      shipments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          carrier: true,
          serviceCode: true,
          waybill: true,
          trackingNumber: true,
          trackingUrl: true,
          status: true,
          createdAt: true,
          shippedAt: true,
          updatedAt: true
        }
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 80,
        select: {
          type: true,
          note: true,
          meta: true,
          createdAt: true
        }
      }
    }
  });

  // ✅ Don’t leak existence
  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }

  const orderEmail = (order.contactEmail ?? '').trim().toLowerCase();
  if (!orderEmail || email !== orderEmail) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }

  const shipments = order.shipments.map((s) => {
    const waybill = s.waybill ?? s.trackingNumber ?? '';
    const trackingUrl = s.trackingUrl ?? (waybill ? buildApcTrackingUrl(waybill) : null);

    return {
      id: s.id,
      carrier: s.carrier,
      serviceCode: s.serviceCode,
      status: s.status,
      waybill: waybill || null,
      trackingUrl,
      createdAt: s.createdAt,
      shippedAt: s.shippedAt,
      updatedAt: s.updatedAt
    };
  });

  const history = normaliseHistory(order.activities);

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      displayId: order.displayId,
      status: order.status,
      createdAt: order.createdAt
    },
    shipments,
    history: history.map((h) => ({
      ...h,
      at: h.at.toISOString()
    }))
  });
}
