'use client';

import { useCart } from '@/lib/cart-store';
import { useMemo, useState } from 'react';
import s from './product.module.scss';

type DiscountMode = string | null;

interface PDPProduct {
  id: string;
  title: string;
  price: number; // pounds
  imageUrl: string | null;
  sku: string | null;
  inventory: number | null;

  // promos
  ribbon: string | null;
  discountMode: DiscountMode;
  discountValue: number | null;
}

const normalizeImage = (src?: string | null): string =>
  !src || !src.trim()
    ? '/assets/prince-foods-logo.png'
    : src.startsWith('//')
      ? `https:${src}`
      : src;

const poundsToPence = (n: number) => Math.round((n ?? 0) * 100);

const track = (payload: unknown) =>
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});

function uniqBadges(input: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of input) {
    const v = String(x ?? '').trim();
    if (!v) continue;
    const k = v.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

// Optional: derive a human badge from discount fields if ribbon is empty.
// Keep conservative so we don't show wrong promos.
function inferDiscountBadge(mode: DiscountMode, value: number | null) {
  const v = typeof value === 'number' && Number.isFinite(value) ? value : null;
  const m = (mode ?? '').toUpperCase();

  if (!m || v == null) return null;

  // You can tweak these to match your schema.
  if (m === 'PERCENT' || m === 'PERCENT_OFF') return `${Math.round(v)}% OFF`;
  if (m === 'AMOUNT' || m === 'AMOUNT_OFF') return `£${v.toFixed(2)} OFF`;

  return null;
}

export default function ProductBuyBox({ product }: { product: PDPProduct }) {
  const [qty, setQty] = useState(1);

  const add = useCart((st) => st.add);
  const open = useCart((st) => st.open);

  const img = normalizeImage(product.imageUrl);

  const badges = useMemo(() => {
    const list: string[] = [];

    if (product.ribbon?.trim()) list.push(product.ribbon.trim());

    const inferred = inferDiscountBadge(product.discountMode, product.discountValue);
    if (inferred) list.push(inferred);

    return uniqBadges(list).slice(0, 2);
  }, [product.ribbon, product.discountMode, product.discountValue]);

  const inStock = product.inventory == null ? true : product.inventory > 0;

  const change = (v: number) => setQty((n) => Math.max(1, Math.min(99, n + v)));
  const set = (v: number) => setQty(Math.max(1, Math.min(99, v || 1)));

  const handleAdd = () => {
    if (!inStock) return;

    add({
      id: product.id, // matches your slider/shop behaviour
      productId: product.id,
      sku: product.sku,
      name: product.title,
      image: img,
      imageUrl: img,
      unitPrice: poundsToPence(product.price),
      quantity: qty
    });

    open();
    track({ type: 'product_click', productId: product.id, action: 'add_to_cart' });
  };

  return (
    <div className={s.buyBox} aria-label="Purchase options">
      {/* promo pills (same concept as ProductCard) */}
      {badges.length > 0 && (
        <div className={s.badges} aria-hidden>
          {badges.map((b, idx) => (
            <span
              key={`${product.id}:${b}`}
              className={`${s.pill} ${idx === 1 ? s.pillSecondary : ''}`}
            >
              {b}
            </span>
          ))}
        </div>
      )}

      <div className={s.buyRow} role="group" aria-label="Add to cart controls">
        <div className={s.qty}>
          <button type="button" onClick={() => change(-1)} aria-label="Decrease quantity">
            −
          </button>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => set(Number(e.target.value))}
            inputMode="numeric"
            aria-label="Quantity"
          />
          <button type="button" onClick={() => change(1)} aria-label="Increase quantity">
            +
          </button>
        </div>

        <button type="button" className={s.add} onClick={handleAdd} disabled={!inStock}>
          {inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>

      {product.inventory != null && product.inventory > 0 && product.inventory <= 5 && (
        <p className={s.stockNote}>Hurry — only {product.inventory} left.</p>
      )}
    </div>
  );
}
