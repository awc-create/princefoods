// src/app/api/offers/badges/route.ts
import { getOffers } from '@/lib/offers-store';
import { prisma } from '@/lib/prisma';
import type {
  OfferAdminForm,
  OfferPayload,
  OfferTargetRule,
  OfferVisibility
} from '@/types/offers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BadgesMap = Record<string, string[]>;

type DealMeta =
  | { mode: 'PERCENT_OFF'; percent: number }
  | { mode: 'AMOUNT_OFF'; amountPence: number }
  | null;

type DealsMap = Record<string, DealMeta>;

interface ProductMini {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  collection: string | null;
  price: number | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

function normStr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normSku(v: unknown): string {
  const s = normStr(v);
  return s ? s.replace(/\s+/g, ' ').toUpperCase() : '';
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));
}

function inVisibility(vis: OfferVisibility): boolean {
  // For product cards, we want offers that are intended to show up on listings.
  return vis === 'ALL' || vis === 'BADGE_ONLY' || vis === 'PRODUCT_PAGE';
}

function isOfferActiveNow(o: OfferAdminForm, now: Date): boolean {
  if (o.status !== 'ACTIVE') return false;

  const startsAt = o.startsAt ? new Date(o.startsAt) : null;
  const endsAt = o.endsAt ? new Date(o.endsAt) : null;

  if (startsAt && now < startsAt) return false;
  if (endsAt && now > endsAt) return false;

  return true;
}

function payloadPools(payload: OfferPayload): OfferTargetRule[][] {
  // returns an array of pools to match against.
  // (BOGOF has buyPool + getPool; others usually have one pool; some have none)
  switch (payload.kind) {
    case 'PERCENT_OFF':
      return [payload.data.pool ?? [{ type: 'ALL_PRODUCTS' }]];
    case 'AMOUNT_OFF':
      return [payload.data.pool ?? [{ type: 'ALL_PRODUCTS' }]];
    case 'X_FOR_Y':
      return [payload.data.pool];
    case 'X_FOR_FIXED_PRICE':
      return [payload.data.pool];
    case 'BOGOF':
      return [payload.data.buyPool, payload.data.getPool];
    case 'SPEND_X_GET_Y':
      // cart-level, not product-targeted by default
      return [];
    case 'FREE_GIFT':
    case 'FLASH_SALE':
    case 'BUNDLE':
      return [];
    default:
      return [];
  }
}

function matchesRule(p: ProductMini, rule: OfferTargetRule): boolean {
  switch (rule.type) {
    case 'ALL_PRODUCTS':
      return true;

    case 'CATEGORY_IDS':
      return !!p.categoryId && rule.ids.includes(p.categoryId);

    case 'PRODUCT_IDS':
      return rule.ids.includes(p.id);

    case 'COLLECTIONS':
      return !!p.collection && rule.names.includes(p.collection);

    case 'NAME_PREFIX': {
      const prefix = normStr(rule.prefix).toLowerCase();
      if (!prefix) return false;
      return normStr(p.name).toLowerCase().startsWith(prefix);
    }

    case 'SKU_PREFIX': {
      const prefix = normSku(rule.prefix);
      if (!prefix) return false;
      return !!p.sku && normSku(p.sku).startsWith(prefix);
    }

    case 'TAG_SLUGS':
      // Not supported here unless you select Product.tags in ProductMini
      return false;

    default:
      return false;
  }
}

function matchesAnyPool(p: ProductMini, pools: OfferTargetRule[][]): boolean {
  for (const pool of pools) {
    if (!pool?.length) continue;
    if (pool.some((r) => matchesRule(p, r))) return true;
  }
  return false;
}

function badgeForOffer(o: OfferAdminForm): string | null {
  const payload = o.payload;

  switch (payload.kind) {
    case 'BOGOF': {
      const buy = Math.max(1, Math.trunc(payload.data.buyQty));
      const get = Math.max(1, Math.trunc(payload.data.getQty));
      return `Buy ${buy} get ${get} free`;
    }
    case 'X_FOR_Y': {
      const buy = Math.max(1, Math.trunc(payload.data.buyQty));
      const pay = Math.max(0, Math.trunc(payload.data.payQty));
      return `${buy} for ${pay}`;
    }
    case 'X_FOR_FIXED_PRICE': {
      const qty = Math.max(1, Math.trunc(payload.data.qty));
      const pricePence = Math.max(0, Math.trunc(payload.data.pricePence));
      return `${qty} for £${(pricePence / 100).toFixed(2)}`;
    }
    case 'PERCENT_OFF': {
      const pct = Math.max(0, Math.min(100, Math.trunc(payload.data.percent)));
      return pct > 0 ? `${pct}% off` : null;
    }
    case 'AMOUNT_OFF': {
      const pence = Math.max(0, Math.trunc(payload.data.amountPence));
      return pence > 0 ? `£${(pence / 100).toFixed(2)} off` : null;
    }
    case 'SPEND_X_GET_Y':
      return null;
    default:
      return null;
  }
}

function dealForOffer(o: OfferAdminForm): DealMeta {
  const p = o.payload;

  if (p.kind === 'PERCENT_OFF') {
    const percent = Math.max(0, Math.min(100, Math.trunc(p.data.percent)));
    return percent > 0 ? { mode: 'PERCENT_OFF', percent } : null;
  }

  if (p.kind === 'AMOUNT_OFF') {
    const amountPence = Math.max(0, Math.trunc(p.data.amountPence));
    return amountPence > 0 ? { mode: 'AMOUNT_OFF', amountPence } : null;
  }

  return null;
}

// compare “which discount is stronger” for a product
function dealValuePence(meta: DealMeta, productPriceGBP: number): number {
  if (!meta) return 0;
  if (meta.mode === 'AMOUNT_OFF') return meta.amountPence;
  // percent-off => value in pence
  return Math.round((productPriceGBP * 100 * meta.percent) / 100);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as unknown;

  const productIds =
    isRecord(body) && Array.isArray(body.productIds)
      ? body.productIds.map((x) => normStr(x)).filter(Boolean)
      : [];

  if (!productIds.length) {
    return NextResponse.json(
      { ok: true, badges: {} satisfies BadgesMap, deals: {} satisfies DealsMap },
      { status: 200 }
    );
  }

  const products: ProductMini[] = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      categoryId: true,
      collection: true,
      price: true
    }
  });

  const offersAll: OfferAdminForm[] = await getOffers();
  const now = new Date();

  // Filter to only offers that should show up as badges
  const offers = offersAll.filter((o) => isOfferActiveNow(o, now) && inVisibility(o.visibility));

  const badges: BadgesMap = {};
  const deals: DealsMap = {};

  for (const p of products) {
    badges[p.id] = [];
    deals[p.id] = null;
  }

  for (const o of offers) {
    const badge = badgeForOffer(o);
    const deal = dealForOffer(o);

    const pools = payloadPools(o.payload);
    if (!pools.length) continue;

    for (const p of products) {
      if (!matchesAnyPool(p, pools)) continue;

      if (badge) {
        badges[p.id] = uniq([...(badges[p.id] ?? []), badge]);
      }

      // pick strongest deal for price display (only for % / £ off)
      if (deal && typeof p.price === 'number' && Number.isFinite(p.price)) {
        const current = deals[p.id];
        const nextVal = dealValuePence(deal, p.price);
        const curVal = dealValuePence(current, p.price);
        if (nextVal > curVal) deals[p.id] = deal;
      }
    }
  }

  return NextResponse.json({ ok: true, badges, deals }, { status: 200 });
}
