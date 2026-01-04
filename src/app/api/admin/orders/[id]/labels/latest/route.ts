// src/app/api/admin/orders/[id]/labels/latest/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true }
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
  }

  const shipment = await prisma.shipment.findFirst({
    where: {
      orderId,
      OR: [{ labelBase64: { not: null } }, { labelUrl: { not: null } }]
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true }
  });

  if (!shipment) {
    return NextResponse.json(
      { ok: false, error: 'No label found for this order' },
      { status: 404 }
    );
  }

  // ✅ origin-safe redirect + preserve ?download=1 if provided
  const current = new URL(req.url);
  const url = new URL(`/api/admin/shipments/${shipment.id}/label`, req.url);

  if (current.searchParams.get('download') === '1') {
    url.searchParams.set('download', '1');
  }

  return NextResponse.redirect(url, 302);
}
