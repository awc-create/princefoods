// src/app/api/shipping/quote/route.ts (FULL)
// ✅ remove express: accept anything but force STANDARD

import { quoteShipping } from '@/lib/shipping';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      country?: string;
      postcode?: string;
      currency?: string;
      service?: 'STANDARD' | 'EXPRESS' | string;
      items?: Array<{ productId: string | null; quantity: number; unitPricePence: number }>;
    };

    const country = typeof body.country === 'string' ? body.country : '';
    const postcode = typeof body.postcode === 'string' ? body.postcode : '';
    const currency = typeof body.currency === 'string' ? body.currency : 'GBP';

    // ✅ always STANDARD
    const service = 'STANDARD' as const;

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return bad('Cart is empty.');

    const result = await quoteShipping({
      country,
      postcode,
      currency,
      service,
      items: items.map((it) => ({
        productId: it.productId ?? null,
        quantity: Math.max(0, Math.trunc(it.quantity ?? 0)),
        unitPricePence: Math.max(0, Math.trunc(it.unitPricePence ?? 0))
      }))
    });

    if (!result.ok) return bad(result.error, 400);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Shipping quote failed.';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
