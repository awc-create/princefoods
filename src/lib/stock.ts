// src/lib/stock.ts
/**
 * Single source of truth for whether a product can be bought.
 *
 * `Product.inventory` is free text and has accumulated several spellings over
 * time: the Wix export uses `InStock` / `OutOfStock`, the admin has also written
 * `In Stock` / `Out of Stock`, and some rows hold a bare number.
 *
 * The old parser did `Number(inv)` and fell back to null, and null was treated
 * as IN STOCK — so all 85 `OutOfStock` products were on sale with a working
 * Add to Cart button. Everything now goes through here instead.
 *
 * Rule: anything we recognise as "out" is out. Anything unrecognised is also
 * treated as OUT, because quietly selling something you don't have is worse
 * than quietly hiding something you do.
 */

export const IN_STOCK = 'InStock';
export const OUT_OF_STOCK = 'OutOfStock';

/** Canonical values written by the admin UI. Matches the Wix/CSV format. */
export const INVENTORY_VALUES = [IN_STOCK, OUT_OF_STOCK] as const;
export type InventoryValue = (typeof INVENTORY_VALUES)[number];

/** Human label for a stored inventory value. */
export function inventoryLabel(raw: string | null | undefined): string {
  const s = normalise(raw);
  if (s === null) return 'Not set';
  return s === IN_STOCK ? 'In stock' : 'Out of stock';
}

function squash(raw: string): string {
  return raw.replace(/[\s_-]+/g, '').toLowerCase();
}

/**
 * Normalises any stored spelling to `InStock` | `OutOfStock`, or null if the
 * value is empty/unrecognised.
 */
export function normalise(raw: string | null | undefined): InventoryValue | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  // Numeric stock counts: 0 (or negative) means out.
  const n = Number(trimmed);
  if (Number.isFinite(n)) return n > 0 ? IN_STOCK : OUT_OF_STOCK;

  const s = squash(trimmed);
  if (['outofstock', 'out', 'soldout', 'unavailable', 'no', 'false', 'oos'].includes(s)) {
    return OUT_OF_STOCK;
  }
  if (['instock', 'in', 'available', 'yes', 'true'].includes(s)) {
    return IN_STOCK;
  }
  return null;
}

/**
 * Can this product be added to the basket and ordered?
 *
 * Unknown/missing values return FALSE — fail closed. If a product disappears
 * from the shop unexpectedly, its `inventory` field needs setting properly,
 * which is a far cheaper problem than refunding an order you can't fulfil.
 */
export function isPurchasable(raw: string | null | undefined): boolean {
  return normalise(raw) === IN_STOCK;
}

/** Optional numeric count, when the field happens to hold a number. */
export function stockCount(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const n = Number(String(raw).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
