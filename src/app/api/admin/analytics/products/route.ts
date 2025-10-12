import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 30)));
    const sort = (url.searchParams.get('sort') ?? 'units').toLowerCase();
    const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 25)));

    // Optional auth/role check here, since this is an admin API.
    // const session = await auth();
    // if (!session?.user || !['HEAD','STAFF'].includes(session.user.role)) {
    //   return NextResponse.json({ ok:false, error:'UNAUTHORIZED' }, { status: 401 });
    // }

    // Build where clause safely and with types
    const where: Prisma.ProductWhereInput = {
      visible: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { sku: { contains: q, mode: 'insensitive' as const } }
            ]
          }
        : {})
    };

    // DB-level sorts (derived metrics will be done in-memory)
    const orderMap: Record<
      'views' | 'clicks' | 'units' | 'revenue' | 'price' | 'name',
      Prisma.ProductOrderByWithRelationInput
    > = {
      views: { views: dir },
      clicks: { clicks: dir },
      units: { unitsSold: dir },
      revenue: { revenuePence: dir },
      price: { price: dir },
      name: { name: dir }
    };

    const dbOrder: Prisma.ProductOrderByWithRelationInput =
      orderMap[(sort as keyof typeof orderMap) || 'units'] ?? orderMap.units;

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: dbOrder,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          price: true,
          productImageUrl: true,
          views: true,
          clicks: true,
          unitsSold: true,
          revenuePence: true
        }
      })
    ]);

    // Derive metrics on the fly
    interface Item {
      id: string;
      name: string;
      price: number | null;
      productImageUrl: string | null;
      views: number;
      clicks: number;
      unitsSold: number;
      revenuePence: number;
      ctr: number; // clicks / views
      conv: number; // units / views
      aov: number; // revenue / units (pence)
      revPerView: number; // revenue / views (pence)
    }

    let items: Item[] = rows.map((r) => {
      const ctr = r.views ? r.clicks / r.views : 0;
      const conv = r.views ? r.unitsSold / r.views : 0;
      const aov = r.unitsSold ? Math.round(r.revenuePence / r.unitsSold) : 0;
      const revPerView = r.views ? Math.round(r.revenuePence / r.views) : 0;
      return { ...r, ctr, conv, aov, revPerView };
    });

    // Handle derived sorts in-memory (ctr, conv, aov, rev_per_view)
    if (sort === 'ctr' || sort === 'conv' || sort === 'aov' || sort === 'rev_per_view') {
      const key = sort === 'rev_per_view' ? 'revPerView' : (sort as 'ctr' | 'conv' | 'aov');
      items = items.sort((a, b) => {
        const av = a[key] ?? 0;
        const bv = b[key] ?? 0;
        return dir === 'asc' ? av - bv : bv - av;
      });
    }

    // Page meta + totals
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const totals = items.reduce(
      (acc, r) => ({
        views: acc.views + r.views,
        clicks: acc.clicks + r.clicks,
        unitsSold: acc.unitsSold + r.unitsSold,
        revenuePence: acc.revenuePence + r.revenuePence
      }),
      { views: 0, clicks: 0, unitsSold: 0, revenuePence: 0 }
    );

    // (Optional) daily trend can be added later via ProductDailyStat if needed here
    return NextResponse.json({
      ok: true,
      meta: {
        page,
        limit,
        total,
        pageCount,
        sort,
        dir,
        from: new Date(Date.now() - (days - 1) * 86400000).toISOString(),
        to: new Date().toISOString()
      },
      totals,
      daily: [],
      items
    });
  } catch (e) {
    console.error('GET /api/admin/analytics/products error', e);
    return NextResponse.json({ ok: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
