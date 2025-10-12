// src/app/api/admin/stats/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [products, customers, orders, sum] = await Promise.all([
      prisma.product.count(),
      prisma.user.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { paymentStatus: { in: ['CAPTURED', 'PARTIAL_REFUND'] } }
      })
    ]);

    const revenuePence = sum._sum.grandTotal ?? 0;

    return NextResponse.json({
      ok: true,
      products,
      customers,
      orders,
      revenuePence
    });
  } catch (e) {
    console.error('[api/admin/stats] failed', e);
    return NextResponse.json({ ok: false, error: 'Stats fetch failed' }, { status: 500 });
  }
}
