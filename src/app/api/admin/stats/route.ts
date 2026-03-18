// src/app/api/admin/stats/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  switch (period) {
    case 'today': {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    case 'month': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    case 'year': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d;
    }
    default:
      return null; // all time
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') ?? 'all';
    const since = getPeriodStart(period);

    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [products, customers, orders, sum, newOrders] = await Promise.all([
      prisma.product.count({ where: { visible: true } }),
      prisma.user.count({ where: dateFilter }),
      prisma.order.count({
        where: { paymentStatus: { in: ['CAPTURED', 'PARTIAL_REFUND'] }, ...dateFilter }
      }),
      prisma.order.aggregate({
        _sum: { grandTotal: true },
        where: { paymentStatus: { in: ['CAPTURED', 'PARTIAL_REFUND'] }, ...dateFilter }
      }),
      // Always show today's new orders regardless of period
      prisma.order.count({
        where: {
          paymentStatus: { in: ['CAPTURED', 'PARTIAL_REFUND'] },
          createdAt: {
            gte: (() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              return d;
            })()
          }
        }
      })
    ]);

    return NextResponse.json({
      ok: true,
      period,
      products,
      customers,
      orders,
      newOrdersToday: newOrders,
      revenuePence: sum._sum.grandTotal ?? 0
    });
  } catch (e) {
    console.error('[api/admin/stats] failed', e);
    return NextResponse.json({ ok: false, error: 'Stats fetch failed' }, { status: 500 });
  }
}
