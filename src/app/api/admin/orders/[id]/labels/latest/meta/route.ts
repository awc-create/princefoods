// src/app/api/admin/orders/[id]/labels/latest/meta/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const shipment = await prisma.shipment.findFirst({
    where: {
      orderId,
      OR: [{ labelBase64: { not: null } }, { labelUrl: { not: null } }]
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      waybill: true,
      labelMime: true,
      labelUrl: true,
      createdAt: true
    }
  });

  return NextResponse.json({ ok: true, shipment: shipment ?? null });
}
