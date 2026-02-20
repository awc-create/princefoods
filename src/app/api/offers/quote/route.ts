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

/** BigInt-safe JSON output */
function jsonSafe<T>(v: T): T {
  return JSON.parse(
    JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val))
  ) as T;
}

interface IncomingLine {
  lineId?: string;
  productId?: string | null;
  sku?: string | null;
  name: string;
  unitPricePence: number;
  qty: number;

  categoryId?: string | null;
  tags?: string[] | null;
  collection?: string | null;
}

function normStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function normSku(v: unknown): string {
  const s = normStr(v);
  return s ? s.replace(/\s+/g, ' ').toUpperCase() : '';
}
function int(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

/**
 * Build an EngineLine WITHOUT forcing nulls.
 * Optional fields are omitted if missing.
 */
function makeEngineLine(input: {
  lineId?: string;
  productId?: string | null;
  sku?: string | null;
  name: string;
  unitPricePence: number;
  qty: number;
  categoryId?: string | null;
  tags?: string[] | null;
  collection?: string | null;
}): EngineLine {
  const out: EngineLine = {
    name: input.name,
    unitPricePence: input.unitPricePence,
    qty: input.qty
  };

  // lineId support (engine may or may not declare it on CartLine)
  const lineId = input.lineId ?? undefined;
  if (lineId) (out as unknown as { lineId?: string }).lineId = lineId;

  const pid = input.productId ?? undefined;
  const sku = input.sku ?? undefined;
  if (pid) out.productId = pid;
  if (sku) out.sku = sku;

  const cat = input.categoryId ?? undefined;
  if (cat) (out as unknown as { categoryId?: string }).categoryId = cat;

  const col = input.collection ?? undefined;
  if (col) (out as unknown as { collection?: string }).collection = col;

  const tags = input.tags ?? undefined;
  if (tags && Array.isArray(tags) && tags.length) {
    (out as unknown as { tags?: string[] }).tags = tags.filter((t) => typeof t === 'string');
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!body || typeof body !== 'object') return bad('BAD_REQUEST');

    const { lines, code } = body as { lines?: IncomingLine[]; code?: string | null };

    // Empty cart => ok, no discounts
    if (!Array.isArray(lines) || lines.length === 0) {
      return ok({
        ok: true,
        result: {
          subtotalPence: 0,
          discountTotalPence: 0,
          discountPence: 0,
          applied: [],
          eligible: [],
          autoAdd: []
        }
      });
    }

    // ✅ Use store (whatever caching/shape you already had)
    // ✅ No normalization needed now (engine supports BOTH)
    const offersForEngine = await getOffers();

    // Enrich from DB so categoryId/collection can come from product when missing
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
    const bySku = new Map(
      products.filter((p) => p.sku).map((p) => [String(p.sku).toUpperCase(), p])
    );

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
          lineId: normStr(l.lineId) || undefined,
          productId: p?.id ?? pid,
          sku: (p?.sku ? String(p.sku).toUpperCase() : sku) ?? null,
          name,
          unitPricePence,
          qty,
          categoryId: (normStr(l.categoryId) || p?.categoryId) ?? null,
          collection: (normStr(l.collection) || p?.collection) ?? null,
          tags: Array.isArray(l.tags) ? l.tags : null
        })
      );
    }

    // If after enrichment we have nothing valid, return empty
    if (!enriched.length) {
      return ok({
        ok: true,
        result: {
          subtotalPence: 0,
          discountTotalPence: 0,
          discountPence: 0,
          applied: [],
          eligible: [],
          autoAdd: []
        }
      });
    }

    // ✅ Subtotal computed here (engine does not return subtotalPence)
    const subtotalPence = enriched.reduce((sum, l) => sum + l.unitPricePence * l.qty, 0);

    const result = evaluateOffers(offersForEngine, {
      lines: enriched,
      code: typeof code === 'string' ? code : null
    });

    return ok(
      jsonSafe({
        ok: true,
        result: {
          subtotalPence,
          discountTotalPence: result.discountTotalPence,
          discountPence: result.discountTotalPence, // alias
          applied: result.applied,
          eligible: result.eligible,
          autoAdd: result.autoAdd
        }
      })
    );
  } catch (e) {
    console.error('[offers/quote] error:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Offer quote failed.' },
      { status: 500 }
    );
  }
}
