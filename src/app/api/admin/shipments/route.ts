// src/app/api/admin/shipments/route.ts
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get('status')?.trim() ?? null;
  const carrier = url.searchParams.get('carrier')?.trim() ?? null;
  const q = url.searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const pageSize = Math.min(50, Math.max(10, Number(url.searchParams.get('pageSize') ?? '20')));
  const skip = (page - 1) * pageSize;

  const where: Prisma.ShipmentWhereInput = {};

  if (status) where.status = status;
  if (carrier) where.carrier = { contains: carrier, mode: 'insensitive' };

  if (q) {
    where.OR = [
      { waybill: { contains: q, mode: 'insensitive' } },
      { trackingNumber: { contains: q, mode: 'insensitive' } },
      { order: { is: { id: { contains: q, mode: 'insensitive' } } } },
      { order: { is: { displayId: { contains: q, mode: 'insensitive' } } } }
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        orderId: true,
        carrier: true,
        serviceCode: true,
        waybill: true,
        trackingUrl: true,
        status: true,
        createdAt: true,
        labelBase64: true,
        labelUrl: true,
        shippedAt: true,
        order: { select: { displayId: true } }
      }
    }),
    prisma.shipment.count({ where })
  ]);

  return NextResponse.json({
    ok: true,
    page,
    pageSize,
    total,
    rows: rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderDisplayId: r.order?.displayId ?? null,
      carrier: r.carrier,
      serviceCode: r.serviceCode,
      waybill: r.waybill,
      trackingUrl: r.trackingUrl,
      status: r.status,
      createdAt: r.createdAt,
      hasLabel: Boolean(r.labelBase64 ?? r.labelUrl),
      shippedAt: r.shippedAt
    }))
  });
}
