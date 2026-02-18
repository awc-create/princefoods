import { authOptions } from '@/lib/auth-options';
import { getOffers } from '@/lib/offers-store';
import { prisma } from '@/lib/prisma';
import type { OfferAdminForm, OfferTargetRule } from '@/types/offers';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

const HEADERS = [
  'Category',
  'Product',
  'NetWeight',
  'UnitsPerCase',
  'UnitPriceGBP',
  'CasePriceGBP',
  'Offer',
  'SKU'
] as const;

type CsvHeader = (typeof HEADERS)[number];

function esc(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtMoneyGBP(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return Number(n).toFixed(2);
}

function fmtNetWeight(grams: number | null | undefined): string {
  if (!grams || !Number.isFinite(grams)) return '';
  const g = Math.round(grams);
  if (g >= 1000 && g % 1000 === 0) return `${g / 1000}kg`;
  if (g >= 1000) return `${(g / 1000).toFixed(2).replace(/\.00$/, '')}kg`;
  return `${g}g`;
}

function isOfferActive(o: OfferAdminForm, now: Date) {
  if (o.status !== 'ACTIVE') return false;
  if (o.startsAt) {
    const d = new Date(o.startsAt);
    if (!Number.isNaN(d.getTime()) && now < d) return false;
  }
  if (o.endsAt) {
    const d = new Date(o.endsAt);
    if (!Number.isNaN(d.getTime()) && now > d) return false;
  }
  return true;
}

function penceToGBP(pence: number) {
  const v = Number.isFinite(pence) ? pence : 0;
  return (v / 100).toFixed(2);
}

// Human label (server-side)
function offerLabel(o: OfferAdminForm) {
  const p = o.payload;

  if (p.kind === 'BOGOF') return `Buy ${p.data.buyQty} get ${p.data.getQty} free`;
  if (p.kind === 'X_FOR_Y') return `Buy ${p.data.buyQty} pay ${p.data.payQty}`;
  if (p.kind === 'X_FOR_FIXED_PRICE') return `${p.data.qty} for £${penceToGBP(p.data.pricePence)}`;
  if (p.kind === 'PERCENT_OFF') return `${p.data.percent}% off`;
  if (p.kind === 'AMOUNT_OFF') return `£${penceToGBP(p.data.amountPence)} off`;
  if (p.kind === 'SPEND_X_GET_Y') return 'Spend & Save';
  return o.name || 'Offer';
}

interface ProductLite {
  id: string;
  name: string;
  sku: string | null;
  collection: string | null;
  categoryId: string | null;
}

// Match product against a rule (same semantics as your engine)
function matchRule(p: ProductLite, rule: OfferTargetRule) {
  switch (rule.type) {
    case 'ALL_PRODUCTS':
      return true;
    case 'CATEGORY_IDS':
      return Boolean(p.categoryId && rule.ids.includes(p.categoryId));
    case 'PRODUCT_IDS':
      return Boolean(p.id && rule.ids.includes(p.id));
    case 'COLLECTIONS':
      return Boolean(p.collection && rule.names.includes(p.collection));
    case 'NAME_PREFIX':
      return p.name.toLowerCase().startsWith(rule.prefix.toLowerCase());
    case 'SKU_PREFIX':
      return Boolean(p.sku && p.sku.toUpperCase().startsWith(rule.prefix.toUpperCase()));
    case 'TAG_SLUGS':
      // you don’t currently export tags on ProductLite; ignore for now
      return false;
    default:
      return false;
  }
}

function matchesAny(p: ProductLite, rules?: OfferTargetRule[] | null) {
  if (!rules || rules.length === 0) return true; // treat empty as "all"
  return rules.some((r) => matchRule(p, r));
}

function offerAppliesToProduct(o: OfferAdminForm, p: ProductLite) {
  const payload = o.payload;

  // If you later support exclusions, apply them here.
  if (payload.kind === 'PERCENT_OFF' || payload.kind === 'AMOUNT_OFF') {
    const pool = payload.data.pool ?? [{ type: 'ALL_PRODUCTS' } as const];
    return matchesAny(p, pool);
  }

  if (payload.kind === 'X_FOR_Y' || payload.kind === 'X_FOR_FIXED_PRICE') {
    return matchesAny(p, payload.data.pool);
  }

  if (payload.kind === 'BOGOF') {
    // show on buy items and/or get items
    return matchesAny(p, payload.data.buyPool) || matchesAny(p, payload.data.getPool);
  }

  if (payload.kind === 'SPEND_X_GET_Y') {
    // typically site-wide message
    return true;
  }

  return false;
}

function pickBestOffer(offers: OfferAdminForm[], p: ProductLite) {
  // priority desc, then newest-ish fallback by name
  const applicable = offers.filter((o) => offerAppliesToProduct(o, p));
  applicable.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return applicable[0] ?? null;
}

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;

  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const allOffers = (await getOffers()).filter((o) => isOfferActive(o, now));

  const items = await prisma.product.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      sku: true,
      price: true,
      caseQty: true,
      collection: true,
      categoryId: true,
      shippingWeightGrams: true,
      category: { select: { name: true, parent: { select: { name: true } } } }
    }
  });

  const lines: string[] = [];
  lines.push(HEADERS.join(','));

  for (const it of items) {
    const pLite: ProductLite = {
      id: it.id,
      name: it.name,
      sku: it.sku,
      collection: it.collection,
      categoryId: it.categoryId ?? null
    };

    const best = pickBestOffer(allOffers, pLite);
    const unit = it.price ?? null;
    const unitsPerCase = it.caseQty ?? null;
    const casePrice =
      unit != null && unitsPerCase != null ? Number(unit) * Number(unitsPerCase) : null;

    const category =
      it.category?.parent?.name && it.category?.name
        ? `${it.category.parent.name} > ${it.category.name}`
        : (it.category?.name ?? '');

    const row: Record<CsvHeader, string | number> = {
      Category: category,
      Product: it.name,
      NetWeight: fmtNetWeight(it.shippingWeightGrams),
      UnitsPerCase: unitsPerCase ?? '',
      UnitPriceGBP: fmtMoneyGBP(unit),
      CasePriceGBP: casePrice != null ? casePrice.toFixed(2) : '',
      Offer: best ? offerLabel(best) : '',
      SKU: it.sku ?? ''
    };

    lines.push(HEADERS.map((h) => esc(row[h])).join(','));
  }

  const csv = lines.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="customer-price-list.csv"',
      'Cache-Control': 'no-store'
    }
  });
}
