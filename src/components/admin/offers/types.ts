// src/components/admin/offers/types.ts
import type { OfferAdminForm, OfferPayload, OfferTargetRule } from '@/types/offers';

export type OfferTargetType = 'SITE_WIDE' | 'PRODUCTS' | 'CATEGORIES';

// ✅ Admin UI supports these 5 now
export type AdminOfferKind =
  | 'BOGOF'
  | 'X_FOR_Y'
  | 'X_FOR_FIXED_PRICE'
  | 'PERCENT_OFF'
  | 'AMOUNT_OFF';

export interface SelectionInput {
  targetType: OfferTargetType;
  productIds?: string[];
  categoryIds?: string[];
}

/**
 * Convert UI selection -> OfferTargetRule[]
 * Engine union:
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
 */
export function adminKindFromPayload(p: OfferPayload): AdminOfferKind {
  if (p.kind === 'BOGOF') return 'BOGOF';
  if (p.kind === 'X_FOR_Y') return 'X_FOR_Y';
  if (p.kind === 'X_FOR_FIXED_PRICE') return 'X_FOR_FIXED_PRICE';
  if (p.kind === 'PERCENT_OFF') return 'PERCENT_OFF';
  if (p.kind === 'AMOUNT_OFF') return 'AMOUNT_OFF';
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
  percent: number | null;

  targetType: OfferTargetType;
  productIds: string[];
  categoryIds: string[];
} {
  const p = o.payload;
  const kind = adminKindFromPayload(p);

  let buyQty = 2;
  let getQty: number | null = null;
  let payQty: number | null = null;
  let pricePence: number | null = null;
  let percent: number | null = null;

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
  } else if (p.kind === 'PERCENT_OFF') {
    percent = typeof p.data.percent === 'number' ? p.data.percent : 0;
    pool = p.data.pool ?? [{ type: 'ALL_PRODUCTS' }];
  } else if (p.kind === 'AMOUNT_OFF') {
    pricePence = typeof p.data.amountPence === 'number' ? p.data.amountPence : 0;
    pool = p.data.pool ?? [{ type: 'ALL_PRODUCTS' }];
  } else {
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
    percent,

    targetType: sel.targetType,
    productIds: sel.productIds,
    categoryIds: sel.categoryIds
  };
}
