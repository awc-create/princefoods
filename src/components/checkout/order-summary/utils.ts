export const normNameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
export const normSkuKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

export function itemKeyOf(x: { productId?: string | null; sku?: string | null; name: string }) {
  if (x.productId) return `pid:${x.productId}`;
  if (x.sku) return `sku:${normSkuKey(x.sku)}`;
  return `name:${normNameKey(x.name)}`;
}

export function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}
