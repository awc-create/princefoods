export interface OfferPayload {
  kind?: string;
  data?: {
    buyQty?: number;
    getQty?: number;
    buyPool?: Array<{ type: string; ids?: string[] }>;
    getPool?: Array<{ type: string; ids?: string[] }>;
  };
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

export function extractOfferProductIds(payload: unknown): string[] {
  const p = payload as OfferPayload | null;
  const buyPool = p?.data?.buyPool ?? [];
  const getPool = p?.data?.getPool ?? [];

  const allPools = [...buyPool, ...getPool];

  const ids: string[] = [];
  for (const pool of allPools) {
    if (!pool || typeof pool !== 'object') continue;
    if (pool.type === 'PRODUCT_IDS' && Array.isArray(pool.ids)) {
      ids.push(...pool.ids);
    }
  }

  return uniq(ids);
}

export function summarizeOffer(payload: unknown): { headline: string; details?: string } {
  const p = payload as OfferPayload | null;
  const kind = (p?.kind ?? '').toUpperCase();
  const buyQty = p?.data?.buyQty ?? null;
  const getQty = p?.data?.getQty ?? null;

  if (kind === 'BOGOF' && buyQty && getQty) {
    return { headline: `Buy ${buyQty} get ${getQty} free` };
  }

  return { headline: 'Special offer' };
}
