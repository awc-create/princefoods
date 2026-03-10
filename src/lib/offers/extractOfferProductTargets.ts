// src/lib/offers/extractOfferProductTargets.ts
type RawPoolRule = Record<string, unknown>;

export interface ExtractedOfferTargets {
  directProductIds: string[];
  includesAllProducts: boolean;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

function readStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function extractPool(pool: unknown): ExtractedOfferTargets {
  if (!Array.isArray(pool)) {
    return { directProductIds: [], includesAllProducts: false };
  }

  const ids = new Set<string>();
  let includesAllProducts = false;

  for (const entry of pool) {
    if (!isRecord(entry)) continue;

    const rule = entry as RawPoolRule;
    const type = typeof rule.type === 'string' ? rule.type : '';

    if (type === 'PRODUCT_IDS') {
      for (const id of readStringArray(rule.ids)) {
        ids.add(id);
      }
    }

    if (type === 'ALL_PRODUCTS') {
      includesAllProducts = true;
    }
  }

  return {
    directProductIds: [...ids],
    includesAllProducts
  };
}

export function extractOfferProductTargets(payload: unknown): ExtractedOfferTargets {
  if (!isRecord(payload)) {
    return { directProductIds: [], includesAllProducts: false };
  }

  const data = isRecord(payload.data) ? payload.data : null;
  if (!data) {
    return { directProductIds: [], includesAllProducts: false };
  }

  const buy = extractPool(data.buyPool);
  const get = extractPool(data.getPool);

  return {
    directProductIds: [...new Set([...buy.directProductIds, ...get.directProductIds])],
    includesAllProducts: buy.includesAllProducts || get.includesAllProducts
  };
}
