// src/app/api/admin/orders/[id]/returns/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type MetaObj = Record<string, unknown>;

function asMetaObj(v: unknown): MetaObj {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as MetaObj) : {};
}

function pickString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const rc = await prisma.returnCase.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' }
  });

  if (!rc) {
    return NextResponse.json({
      ok: true,
      returnCase: null,
      shipment: null,
      originalShipment: null,
      reshipShipment: null
    });
  }

  const meta = asMetaObj(rc.meta);
  const originalShipmentId = pickString(meta.originalShipmentId);
  const reshipShipmentId = pickString(meta.reshipShipmentId);

  // Fetch up to 3 shipments:
  // - current: rc.shipmentId
  // - original: meta.originalShipmentId (if present)
  // - reship: meta.reshipShipmentId (if present)
  const ids = Array.from(
    new Set([rc.shipmentId ?? null, originalShipmentId, reshipShipmentId].filter(Boolean))
  ) as string[];

  const shipments = ids.length
    ? await prisma.shipment.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          orderId: true,
          carrier: true,
          status: true,
          waybill: true,
          trackingNumber: true,
          trackingUrl: true,
          createdAt: true,
          updatedAt: true
        }
      })
    : [];

  const byId = new Map(shipments.map((s) => [s.id, s]));

  return NextResponse.json({
    ok: true,
    returnCase: rc,
    shipment: rc.shipmentId ? (byId.get(rc.shipmentId) ?? null) : null,
    originalShipment: originalShipmentId ? (byId.get(originalShipmentId) ?? null) : null,
    reshipShipment: reshipShipmentId ? (byId.get(reshipShipmentId) ?? null) : null
  });
}
