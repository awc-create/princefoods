// src/components/admin/offers/types.ts
import type { OfferAdminForm, OfferPayload, OfferTargetRule } from '@/types/offers';

export type OfferTargetType = 'SITE_WIDE' | 'PRODUCTS' | 'CATEGORIES';

// Admin UI only supports these 3
export type AdminOfferKind = 'BOGOF' | 'X_FOR_Y' | 'X_FOR_FIXED_PRICE';

export interface SelectionInput {
  targetType: OfferTargetType;
  productIds?: string[];
  categoryIds?: string[];
}

/**
 * Convert UI selection -> OfferTargetRule[]
 * Your engine union uses:
 * - ALL_PRODUCTS
 * - PRODUCT_IDS { ids }
 * - CATEGORY_IDS { ids }
 */
export function selectionToPool(sel: SelectionInput): OfferTargetRule[] {
  if (sel.targetType === 'SITE_WIDE') return [{ type: 'ALL_PRODUCTS' }];

  if (sel.targetType === 'PRODUCTS') {
    const ids = (sel.productIds ?? []).filter(Boolean);
    return ids.length ? [{ type: 'PRODUCT_IDS', ids }] : [{ type: 'ALL_PRODUCTS' }];
  }

  const ids = (sel.categoryIds ?? []).filter(Boolean);
  return ids.length ? [{ type: 'CATEGORY_IDS', ids }] : [{ type: 'ALL_PRODUCTS' }];
}

export function selectionFromPool(pool: OfferTargetRule[] | null | undefined): {
  targetType: OfferTargetType;
  productIds: string[];
  categoryIds: string[];
} {
  const rules = Array.isArray(pool) ? pool : [];

  const prod = rules.find((r) => r.type === 'PRODUCT_IDS');
  if (prod && 'ids' in prod) {
    return { targetType: 'PRODUCTS', productIds: prod.ids ?? [], categoryIds: [] };
  }

  const cat = rules.find((r) => r.type === 'CATEGORY_IDS');
  if (cat && 'ids' in cat) {
    return { targetType: 'CATEGORIES', productIds: [], categoryIds: cat.ids ?? [] };
  }

  return { targetType: 'SITE_WIDE', productIds: [], categoryIds: [] };
}

/**
 * Map ANY payload kind -> admin kind (fallback to BOGOF)
 * because store may contain other kinds not editable in this UI.
 */
export function adminKindFromPayload(p: OfferPayload): AdminOfferKind {
  if (p.kind === 'BOGOF') return 'BOGOF';
  if (p.kind === 'X_FOR_Y') return 'X_FOR_Y';
  if (p.kind === 'X_FOR_FIXED_PRICE') return 'X_FOR_FIXED_PRICE';
  return 'BOGOF';
}

export function uiFromAdminForm(o: OfferAdminForm): {
  name: string;
  status: OfferAdminForm['status'];

  kind: AdminOfferKind;

  buyQty: number;
  getQty: number | null;
  payQty: number | null;
  pricePence: number | null;

  targetType: OfferTargetType;
  productIds: string[];
  categoryIds: string[];
} {
  const p = o.payload;
  const kind = adminKindFromPayload(p);

  // defaults
  let buyQty = 2;
  let getQty: number | null = null;
  let payQty: number | null = null;
  let pricePence: number | null = null;

  let pool: OfferTargetRule[] = [{ type: 'ALL_PRODUCTS' }];

  if (p.kind === 'BOGOF') {
    buyQty = p.data.buyQty ?? 2;
    getQty = p.data.getQty ?? 1;
    pool = p.data.buyPool ?? [{ type: 'ALL_PRODUCTS' }];
  } else if (p.kind === 'X_FOR_Y') {
    buyQty = p.data.buyQty ?? 2;
    payQty = p.data.payQty ?? 1;
    pool = p.data.pool ?? [{ type: 'ALL_PRODUCTS' }];
  } else if (p.kind === 'X_FOR_FIXED_PRICE') {
    buyQty = p.data.qty ?? 2;
    pricePence = p.data.pricePence ?? 0;
    pool = p.data.pool ?? [{ type: 'ALL_PRODUCTS' }];
  } else {
    // Unsupported kind in UI → keep safe defaults and SITE_WIDE
    buyQty = 2;
    getQty = 1;
    pool = [{ type: 'ALL_PRODUCTS' }];
  }

  const sel = selectionFromPool(pool);

  return {
    name: o.name ?? '',
    status: o.status ?? 'ACTIVE',

    kind,

    buyQty,
    getQty,
    payQty,
    pricePence,

    targetType: sel.targetType,
    productIds: sel.productIds,
    categoryIds: sel.categoryIds
  };
}

export function payloadFromUi(args: {
  kind: AdminOfferKind;
  buyQty: number;
  getQty: number | null;
  payQty: number | null;
  pricePence: number | null;
  pool: OfferTargetRule[];
}): OfferAdminForm['payload'] {
  const { kind, buyQty, getQty, payQty, pricePence, pool } = args;

  if (kind === 'BOGOF') {
    return {
      kind: 'BOGOF',
      data: {
        buyQty,
        getQty: getQty ?? 1,
        buyPool: pool,
        getPool: pool,
        warnIfGetMoreExpensive: true,
        autoAddGetItem: true
      }
    };
  }

  if (kind === 'X_FOR_Y') {
    return {
      kind: 'X_FOR_Y',
      data: {
        buyQty,
        payQty: payQty ?? 1,
        pool
      }
    };
  }

  return {
    kind: 'X_FOR_FIXED_PRICE',
    data: {
      qty: buyQty,
      pricePence: Math.max(0, Math.trunc(pricePence ?? 0)),
      pool
    }
  };
}
