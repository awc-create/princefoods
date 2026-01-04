import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type ExceptionType =
  | 'NEEDS_LABEL'
  | 'LABEL_PENDING'
  | 'NO_TRACKING_EVENTS'
  | 'NO_SCAN_24H'
  | 'IN_TRANSIT_LONG'
  | 'STALE_ORDER';

interface ExceptionItem {
  orderId: string;
  displayId: string;
  createdAt: string;
  updatedAt: string;

  contactEmail: string;
  grandTotal: number;

  shipmentId: string | null;
  shipmentStatus: string | null;
  waybill: string | null;
  trackingNumber: string | null;
  labelUrl: string | null;

  lastScanAt: string | null;
  hoursSinceLastScan: number | null;

  exceptionType: ExceptionType;
  message: string;
  ageDays: number;

  // ✅ resolution
  isResolved: boolean;
  resolvedAt: string | null;
}

const RESOLVED_TAG_SLUG = 'exceptions-resolved';

function daysSince(d: Date) {
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function hoursSince(d: Date) {
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60));
}

function isPaid(paymentStatus: string) {
  return paymentStatus === 'CAPTURED';
}

function isDeliveredShipment(status: string | null | undefined) {
  if (!status) return false;
  return status.toUpperCase() === 'DELIVERED';
}

/**
 * Best-effort extraction of timestamps from trackingEvents.
 * Supports arrays, objects, nested shapes.
 */
function extractDatesFromTrackingEvents(trackingEvents: unknown): Date[] {
  const dates: Date[] = [];

  const tryParse = (v: unknown) => {
    if (typeof v === 'string') {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    } else if (typeof v === 'number') {
      const ms = v < 2_000_000_000 ? v * 1000 : v;
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) dates.push(d);
    }
  };

  const visit = (node: unknown, depth = 0) => {
    if (depth > 6) return;

    if (Array.isArray(node)) {
      for (const it of node) visit(it, depth + 1);
      return;
    }

    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;

      const keys = [
        'date',
        'datetime',
        'time',
        'timestamp',
        'createdAt',
        'updatedAt',
        'eventAt',
        'scanAt',
        'occurredAt'
      ];

      for (const k of keys) {
        if (k in obj) tryParse(obj[k]);
      }

      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          if (v.includes('T') || v.includes('-') || v.includes('/')) tryParse(v);
        } else if (typeof v === 'number') {
          if (k.toLowerCase().includes('time') || k.toLowerCase().includes('stamp')) tryParse(v);
        } else if (v && typeof v === 'object') {
          visit(v, depth + 1);
        }
      }
    }
  };

  visit(trackingEvents);

  const uniq = new Map<number, Date>();
  for (const d of dates) uniq.set(d.getTime(), d);

  return Array.from(uniq.values()).sort((a, b) => a.getTime() - b.getTime());
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const inTransitDays = Number(url.searchParams.get('inTransitDays') ?? 4);
  const staleDays = Number(url.searchParams.get('staleDays') ?? 3);
  const noScanHours = Number(url.searchParams.get('noScanHours') ?? 24);

  // ✅ default: hide resolved
  const includeResolved = (url.searchParams.get('includeResolved') ?? '0') === '1';

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true,
      displayId: true,
      createdAt: true,
      updatedAt: true,
      contactEmail: true,
      grandTotal: true,
      paymentStatus: true,
      canceledAt: true,
      archivedAt: true,
      orderTags: {
        select: {
          assignedAt: true,
          tag: { select: { slug: true } }
        }
      },
      shipments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          shippedAt: true,
          waybill: true,
          trackingNumber: true,
          labelUrl: true,
          trackingEvents: true,
          updatedAt: true,
          createdAt: true
        }
      }
    }
  });

  const items: ExceptionItem[] = [];

  for (const o of orders) {
    if (o.canceledAt) continue;
    if (o.archivedAt) continue;
    if (!isPaid(o.paymentStatus)) continue;

    const resolvedTag = o.orderTags.find((t) => t.tag.slug === RESOLVED_TAG_SLUG) ?? null;
    const isResolved = Boolean(resolvedTag);
    const resolvedAt = resolvedTag?.assignedAt ? resolvedTag.assignedAt.toISOString() : null;

    if (!includeResolved && isResolved) continue;

    const ageDays = daysSince(o.createdAt);

    const shipment = o.shipments[0] ?? null;
    const delivered = shipment ? isDeliveredShipment(shipment.status) : false;
    if (delivered) continue;

    const hasShipment = Boolean(shipment);
    const hasLabel = Boolean(shipment?.labelUrl);
    const tracking = shipment?.trackingNumber ?? shipment?.waybill;
    const hasTracking = Boolean(tracking);

    const trackingEvents = shipment?.trackingEvents;

    const extractedDates = trackingEvents ? extractDatesFromTrackingEvents(trackingEvents) : [];
    const lastScanDate = extractedDates.length ? extractedDates[extractedDates.length - 1] : null;

    const lastScanAt = lastScanDate ? lastScanDate.toISOString() : null;
    const hoursSinceLastScan = lastScanDate ? hoursSince(lastScanDate) : null;

    let exceptionType: ExceptionType | null = null;
    let message = '';

    if (!hasShipment) {
      exceptionType = 'NEEDS_LABEL';
      message = 'Paid order has no shipment record yet (no label booked).';
    }

    if (!exceptionType && hasShipment && !hasLabel) {
      exceptionType = 'LABEL_PENDING';
      message = 'Shipment exists but labelUrl is missing (label not ready / not saved).';
    }

    if (!exceptionType && hasShipment && hasLabel && !hasTracking) {
      exceptionType = 'NO_TRACKING_EVENTS';
      message = 'Label exists but tracking number/waybill is missing.';
    }

    if (!exceptionType && hasShipment && hasTracking && extractedDates.length === 0) {
      exceptionType = 'NO_TRACKING_EVENTS';
      message = 'Tracking exists but no tracking event timestamps found.';
    }

    if (
      !exceptionType &&
      hasShipment &&
      hasTracking &&
      (hoursSinceLastScan === null || hoursSinceLastScan >= noScanHours)
    ) {
      exceptionType = 'NO_SCAN_24H';
      message =
        hoursSinceLastScan === null
          ? 'No scan detected yet (tracking exists).'
          : `No scan in ${hoursSinceLastScan} hours (threshold ${noScanHours}h).`;
    }

    if (!exceptionType && hasShipment && hasTracking) {
      const anchor = shipment?.shippedAt ?? shipment?.createdAt ?? o.createdAt;
      const transitDays = daysSince(anchor);

      if (transitDays >= inTransitDays) {
        exceptionType = 'IN_TRANSIT_LONG';
        message = `Shipment not delivered after ${transitDays} days.`;
      }
    }

    if (!exceptionType) {
      const updatedAge = daysSince(o.updatedAt);
      if (updatedAge >= staleDays) {
        exceptionType = 'STALE_ORDER';
        message = `Order has not updated in ${updatedAge} days.`;
      }
    }

    if (!exceptionType) continue;

    items.push({
      orderId: o.id,
      displayId: o.displayId,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      contactEmail: o.contactEmail,
      grandTotal: o.grandTotal,

      shipmentId: shipment?.id ?? null,
      shipmentStatus: shipment?.status ?? null,
      waybill: shipment?.waybill ?? null,
      trackingNumber: shipment?.trackingNumber ?? null,
      labelUrl: shipment?.labelUrl ?? null,

      lastScanAt,
      hoursSinceLastScan,

      exceptionType,
      message,
      ageDays,

      isResolved,
      resolvedAt
    });
  }

  return NextResponse.json({ ok: true, count: items.length, items });
}
