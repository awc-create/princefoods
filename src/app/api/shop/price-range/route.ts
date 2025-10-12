// src/app/api/shop/price-range/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type PriceRangeResponse = { ok: true; min: number; max: number } | { ok: false; error: string };

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const agg = await prisma.product.aggregate({
      where: { visible: true, price: { not: null } },
      _min: { price: true },
      _max: { price: true }
    });

    const rawMin = agg._min.price ?? 0;
    const rawMax = agg._max.price ?? 0;

    // prices stored as pounds (Float)
    const min = Math.floor(rawMin);
    const max = Math.ceil(rawMax);

    return NextResponse.json<PriceRangeResponse>({ ok: true, min, max });
  } catch {
    return NextResponse.json<PriceRangeResponse>(
      { ok: false, error: 'Failed to compute price range' },
      { status: 500 }
    );
  }
}
