import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Helper: get yyyy-mm-dd for a Date
function dstr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Zero-filled daily series for last N days (includes today)
function emptyDaily(days: number) {
  const out: {
    day: string;
    views: number;
    clicks: number;
    unitsSold: number;
    revenuePence: number;
  }[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push({ day: dstr(d), views: 0, clicks: 0, unitsSold: 0, revenuePence: 0 });
  }
  return out;
}

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const url = new URL(req.url);
    const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days') ?? '90')));

    // Use your actual columns: id, name, price, productImageUrl
    const prod = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        price: true,
        productImageUrl: true
      }
    });

    if (!prod) {
      return NextResponse.json(
        { ok: true, product: null, daily: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Aggregates from order items (adjust table/fields if different)
    let unitsSold = 0;
    let revenuePence = 0;

    try {
      const agg = await prisma.orderItem.groupBy({
        by: ['productId'],
        where: { productId: id },
        _sum: { quantity: true, lineTotal: true }
      });
      const a = agg[0];
      if (a) {
        unitsSold = (a._sum.quantity ?? 0) as number;
        revenuePence = (a._sum.lineTotal ?? 0) as number;
      }
    } catch {
      // keep zeros if orderItem not present
    }

    // Daily series: zero fallback (wire up your real daily table later if you have one)
    let daily = emptyDaily(days);

    // Example to use a real table later:
    // const from = new Date(); from.setDate(from.getDate() - (days - 1));
    // const rows = await prisma.productAnalyticsDaily.findMany({ where: { productId: id, day: { gte: from } }, orderBy: { day: 'asc' } });
    // const map = new Map(rows.map(r => [dstr(new Date(r.day)), r]));
    // daily = emptyDaily(days).map(d => {
    //   const r = map.get(d.day);
    //   return r ? { day: d.day, views: r.views ?? 0, clicks: r.clicks ?? 0, unitsSold: r.unitsSold ?? 0, revenuePence: r.revenuePence ?? 0 } : d;
    // });

    const product = {
      id: prod.id,
      name: prod.name ?? 'Product',
      price: prod.price, // number | null; client formats it
      productImageUrl: prod.productImageUrl ?? null,
      views: daily.reduce((s, r) => s + r.views, 0),
      clicks: daily.reduce((s, r) => s + r.clicks, 0),
      unitsSold,
      revenuePence
    };

    return NextResponse.json(
      { ok: true, product, daily },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    console.error('GET /api/admin/analytics/products/[id] failed:', e);
    return NextResponse.json({ ok: false, error: 'ANALYTICS_FAILED' }, { status: 500 });
  }
}
