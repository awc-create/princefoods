// src/app/api/products/prices/route.ts
/**
 * Current price + availability for a set of product ids.
 *
 * The basket persists `unitPrice` in localStorage indefinitely, while
 * /api/checkout/place-order rejects any line whose price no longer matches the
 * database. Without this endpoint a basket left for a week dead-ends at payment
 * with "Price mismatch … expected 299p, got 275p" and no way to recover.
 *
 * Public on purpose: it exposes nothing a shopper can't already see on the
 * product page. Capped so it can't be used to dump the catalogue.
 */
import { prisma } from '@/lib/prisma';
import { isPurchasable } from '@/lib/stock';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_IDS = 100;

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { ids?: unknown };

    const ids = Array.isArray(body.ids)
      ? Array.from(
          new Set(
            body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0)
          )
        ).slice(0, MAX_IDS)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ ok: true, products: [] });
    }

    const rows = await prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, price: true, inventory: true, visible: true }
    });

    const products = rows.map((p) => ({
      id: p.id,
      name: p.name,
      // pence, matching the cart's unit
      unitPrice: Math.round((p.price ?? 0) * 100),
      purchasable: isPurchasable(p.inventory) && p.visible !== false
    }));

    // ids we were asked about but couldn't find — the cart should drop these
    const found = new Set(products.map((p) => p.id));
    const missing = ids.filter((id) => !found.has(id));

    return NextResponse.json(
      { ok: true, products, missing },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not load prices.' }, { status: 500 });
  }
}
