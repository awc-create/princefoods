// src/app/api/admin/orders/route.ts
import { prisma } from '@/lib/prisma';
import type { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type ProviderFilter = 'all' | 'stripe' | 'test';
type ArchivedFilter = 'active' | 'archived' | 'all';

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
  archivedAt?: string | null;
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

    const q = url.searchParams.get('q')?.trim() ?? '';
    const status = (url.searchParams.get('status') as OrderStatus | null) ?? null;
    const paymentStatus = (url.searchParams.get('paymentStatus') as PaymentStatus | null) ?? null;
    const provider = (url.searchParams.get('provider') as ProviderFilter | null) ?? 'all';
    const archived = (url.searchParams.get('archived') as ArchivedFilter | null) ?? 'active';

    const whereAND: Prisma.OrderWhereInput[] = [];

    // 🔍 Search across multiple fields (id, displayId, contactEmail, user.name, user.email)
    if (q) {
      const tokens = q
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);

      whereAND.push({
        AND: tokens.map((tok) => ({
          OR: [
            { id: { contains: tok, mode: 'insensitive' } },
            { displayId: { contains: tok, mode: 'insensitive' } },
            { contactEmail: { contains: tok, mode: 'insensitive' } },
            { user: { is: { name: { contains: tok, mode: 'insensitive' } } } },
            { user: { is: { email: { contains: tok, mode: 'insensitive' } } } }
          ]
        }))
      });
    }

    if (status) whereAND.push({ status });
    if (paymentStatus) whereAND.push({ paymentStatus });

    // 💳 Provider mapping: "stripe" = live; "test" = any test marker
    if (provider === 'stripe') {
      whereAND.push({ paymentProvider: { in: ['stripe', 'stripe_live'] } });
    } else if (provider === 'test') {
      whereAND.push({ paymentProvider: { in: ['test', 'stripe_test'] } });
    }

    // 🗃️ Archived filter
    if (archived === 'active') {
      whereAND.push({ archivedAt: null });
    } else if (archived === 'archived') {
      whereAND.push({ NOT: { archivedAt: null } });
    }

    const where: Prisma.OrderWhereInput = whereAND.length ? { AND: whereAND } : {};

    // 📊 Total count for pagination
    const total = await prisma.order.count({ where });

    // 📦 Fetch orders with counts + user for name/email
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: true,
        _count: { select: { items: true } }
      }
    });

    // 🧾 Map results
    const items: ListItem[] = orders.map((o) => ({
      id: o.id,
      displayId: o.displayId,
      createdAt: o.createdAt.toISOString(),
      status: o.status,
      paymentStatus: o.paymentStatus,
      contactEmail: o.contactEmail ?? o.user?.email ?? '',
      grandTotal: o.grandTotal ?? 0,
      items: o._count.items ?? 0,
      paymentProvider: o.paymentProvider,
      totalWeightGrams: o.totalWeightGrams ?? null,
      archivedAt: o.archivedAt ? o.archivedAt.toISOString() : null
    }));

    // 📬 Response
    const res: ListResponse = {
      ok: true,
      meta: {
        page,
        limit,
        total,
        pageCount: Math.max(1, Math.ceil(total / limit))
      },
      items
    };

    return NextResponse.json(res, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('GET /api/admin/orders failed:', err);
    return NextResponse.json({ ok: false, error: 'LIST_FAILED' }, { status: 500 });
  }
}
