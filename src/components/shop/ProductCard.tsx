'use client';

import type { Product } from '@/types/product';
import Image from 'next/image';
import { useState } from 'react';
import s from './ProductCard.module.scss';

export default function ProductCard({
  product,
  onAddToCart
}: {
  product: Product;
  onAddToCart?: (id: string, qty: number) => void;
}) {
  const [qty, setQty] = useState(1);
  const img = product.imageUrl ?? '/assets/prince-foods-logo.png';

  const change = (v: number) => setQty((n) => Math.max(1, n + v));
  const set = (v: number) => setQty(Math.max(1, v || 1));

  return (
    <article className={s.card} tabIndex={-1}>
      <div className={s.imageWrap}>
        <Image
          src={img}
          alt={product.title}
          fill
          className={s.image}
          sizes="(max-width: 900px) 50vw, 300px"
          priority={false}
        />
        {product.tag && <span className={s.badge}>{product.tag}</span>}
        <span className={s.quick}>Quick View</span>
      </div>

      <h3 className={s.title} title={product.title}>
        {product.title}
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

        <button type="button" className={s.add} onClick={() => onAddToCart?.(product.id, qty)}>
          Add to Cart
        </button>
      </div>
    </article>
  );
}
