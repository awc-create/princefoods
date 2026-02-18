'use client';

import { useCart } from '@/lib/cart-store';
import type { Product } from '@/types/product';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import s from './ProductCard.module.scss';

const normalizeImage = (src?: string | null): string =>
  !src || !src.trim()
    ? '/assets/prince-foods-logo.png'
    : src.startsWith('//')
      ? `https:${src}`
      : src;

const poundsToPence = (n: number) => Math.round(n * 100);

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

export default function ProductCard({
  product,
  promoBadges = []
}: {
  product: Product;
  promoBadges?: string[];
}) {
  const [qty, setQty] = useState(1);
  const add = useCart((st) => st.add);
  const open = useCart((st) => st.open);

  const img = normalizeImage(product.imageUrl);

  const badges = useMemo(() => uniqBadges(promoBadges).slice(0, 2), [promoBadges]);

  const change = (v: number) => setQty((n) => Math.max(1, n + v));
  const set = (v: number) => setQty(Math.max(1, v || 1));

  const handleAdd = () => {
    add({
      id: product.id,
      productId: product.id,
      name: product.title,
      image: img,
      imageUrl: img,
      unitPrice: poundsToPence(product.price),
      quantity: qty
    });
    open();
    track({ type: 'product_click', productId: product.id, action: 'add_to_cart' });
  };

  const onCardClick = () => track({ type: 'product_click', productId: product.id, action: 'view' });

  return (
    <article className={s.card} tabIndex={-1}>
      <Link
        href={`/product/${product.id}`}
        onClick={onCardClick}
        className={s.imageWrap}
        aria-label={product.title}
      >
        <Image
          src={img}
          alt={product.title}
          fill
          className={s.image}
          sizes="(max-width: 900px) 50vw, 300px"
          priority={false}
        />

        {/* ✅ promo pills */}
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
      </Link>

      <div className={s.content}>
        <h3 className={s.title}>
          <Link href={`/product/${product.id}`} onClick={onCardClick}>
            {product.title}
          </Link>
        </h3>

        <div className={s.priceRow}>
          <span className={s.price}>£{product.price.toFixed(2)}</span>
        </div>

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

          <button type="button" className={s.add} onClick={handleAdd}>
            Add to Cart
          </button>
        </div>
      </div>
    </article>
  );
}
