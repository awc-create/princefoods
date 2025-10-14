import { prisma } from '@/lib/prisma';
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type ProviderFilter = 'all' | 'stripe' | 'test';

interface ListItem {
  id: string;
  displayId?: string | null;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  contactEmail: string;
  grandTotal: number; // pence
  items: number;
  paymentProvider: string | null; // 'stripe' | 'stripe_test' | 'test' | null
  totalWeightGrams?: number | null;
}

interface ListResponse {
  ok: true;
  meta: { page: number; limit: number; total: number; pageCount: number };
  items: ListItem[];
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
    const q = url.searchParams.get('q')?.trim();
    const status = url.searchParams.get('status') as OrderStatus | null;
    const paymentStatus = url.searchParams.get('paymentStatus') as PaymentStatus | null;
    const provider = (url.searchParams.get('provider') as ProviderFilter | null) ?? 'all';

    const whereAND: Prisma.OrderWhereInput[] = [];

    if (q) {
      whereAND.push({
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { displayId: { contains: q, mode: 'insensitive' } }, // 👈 search by order no
          { contactEmail: { contains: q, mode: 'insensitive' } }
        ]
      });
    }
    if (status) whereAND.push({ status });
    if (paymentStatus) whereAND.push({ paymentStatus });

    // Provider mapping: "stripe" = live; "test" = any test marker
    if (provider === 'stripe') {
      whereAND.push({ paymentProvider: { in: ['stripe', 'stripe_live'] } });
    } else if (provider === 'test') {
      whereAND.push({ paymentProvider: { in: ['test', 'stripe_test'] } });
    }

    const where: Prisma.OrderWhereInput = whereAND.length ? { AND: whereAND } : {};

    const total = await prisma.order.count({ where });
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { items: true } } }
    });

    const items: ListItem[] = orders.map((o) => ({
      id: o.id,
      displayId: o.displayId,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      contactEmail: o.contactEmail,
      grandTotal: o.grandTotal,
      items: o._count.items,
      paymentProvider: o.paymentProvider,
      totalWeightGrams: o.totalWeightGrams ?? null
    }));

    const res: ListResponse = {
      ok: true,
      meta: { page, limit, total, pageCount: Math.max(1, Math.ceil(total / limit)) },
      items
    };
    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/admin/orders failed:', err);
    return NextResponse.json({ ok: false, error: 'LIST_FAILED' }, { status: 500 });
  }
}
