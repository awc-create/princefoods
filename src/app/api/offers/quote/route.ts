// src/app/api/offers/quote/route.ts
import { evaluateOffers, type CartLine as EngineLine } from '@/lib/offers-engine';
import { getOffers } from '@/lib/offers-store';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function ok(json: unknown) {
  return NextResponse.json(json, { status: 200 });
}
function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

interface IncomingLine {
  productId?: string | null;
  sku?: string | null;
  name: string;
  unitPricePence: number;
  qty: number;
}

function normStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function normSku(v: unknown): string {
  const s = normStr(v);
  return s ? s.replace(/\s+/g, ' ').toUpperCase() : '';
}
function int(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
  return n;
}

/**
 * Build an EngineLine WITHOUT forcing nulls.
 * Optional fields are omitted if missing, which matches your CartLine type better.
 */
function makeEngineLine(input: {
  productId?: string | null;
  sku?: string | null;
  name: string;
  unitPricePence: number;
  qty: number;
  categoryId?: string | null;
  collection?: string | null;
}): EngineLine {
  const out: EngineLine = {
    name: input.name,
    unitPricePence: input.unitPricePence,
    qty: input.qty
  };

  const pid = input.productId ?? undefined;
  const sku = input.sku ?? undefined;

  if (pid) out.productId = pid;
  if (sku) out.sku = sku;

  const cat = input.categoryId ?? undefined;
  const col = input.collection ?? undefined;

  if (cat) out.categoryId = cat;
  if (col) out.collection = col;

  // you don’t have tags in Product yet; keep undefined
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || typeof body !== 'object') return bad('BAD_REQUEST');

  const { lines, code } = body as { lines?: IncomingLine[]; code?: string | null };
  if (!Array.isArray(lines) || lines.length === 0) return bad('LINES_REQUIRED');

  const offers = await getOffers();

  const productIds = Array.from(new Set(lines.map((l) => normStr(l.productId)).filter(Boolean)));
  const skus = Array.from(new Set(lines.map((l) => normSku(l.sku)).filter(Boolean)));

  const products = await prisma.product.findMany({
    where:
      productIds.length || skus.length
        ? {
            OR: [
              ...(productIds.length ? [{ id: { in: productIds } }] : []),
              ...(skus.length ? [{ sku: { in: skus } }] : [])
            ]
          }
        : undefined,
    select: {
      id: true,
      sku: true,
      name: true,
      categoryId: true,
      collection: true
    }
  });

  const byId = new Map(products.map((p) => [p.id, p]));
  const bySku = new Map(products.filter((p) => p.sku).map((p) => [String(p.sku).toUpperCase(), p]));

  // ✅ No nulls, no failing predicate, exact EngineLine shape
  const enriched: EngineLine[] = [];
  for (const l of lines) {
    const pid = normStr(l.productId) || null;
    const sku = normSku(l.sku) || null;

    const p = (pid ? byId.get(pid) : undefined) ?? (sku ? bySku.get(sku) : undefined);

    const qty = Math.max(1, int(l.qty, 1));
    const unitPricePence = Math.max(0, int(l.unitPricePence, 0));
    const name = (normStr(l.name) || p?.name) ?? '';

    if (!name) continue;

    enriched.push(
      makeEngineLine({
        productId: p?.id ?? pid,
        sku: (p?.sku ? String(p.sku).toUpperCase() : sku) ?? null,
        name,
        unitPricePence,
        qty,
        categoryId: p?.categoryId ?? null,
        collection: p?.collection ?? null
      })
    );
  }

  const result = evaluateOffers(offers, {
    lines: enriched,
    code: typeof code === 'string' ? code : null
  });

  return ok({
    ok: true,
    result: {
      subtotalPence: result.subtotalPence,
      discountPence: result.discountTotalPence,
      applied: result.applied,
      eligible: result.eligible,
      autoAdd: result.autoAdd
    }
  });
}
