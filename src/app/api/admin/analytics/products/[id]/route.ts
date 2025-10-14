import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const url = new URL(req.url);
  const days = Math.max(1, Math.min(365, Number(url.searchParams.get('days') ?? 90) || 90));
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(to.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);

  const product = await prisma.product.findUnique({
    where: { id },
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
  });

  if (!product) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const rows = await prisma.productDailyStat.findMany({
    where: {
      productId: id,
      day: { gte: from, lte: to }
    },
    orderBy: { day: 'asc' },
    select: { day: true, views: true, clicks: true, unitsSold: true, revenuePence: true }
  });

  const daily = rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    views: r.views,
    clicks: r.clicks,
    unitsSold: r.unitsSold,
    revenuePence: r.revenuePence
  }));

  return NextResponse.json({ ok: true, product, daily });
}
