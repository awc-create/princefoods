// src/components/shop/ProductCard.tsx
'use client';

import { useCart } from '@/lib/cart-store';
import type { Product } from '@/types/product';
import Image from 'next/image';
import { useState } from 'react';
import s from './ProductCard.module.scss';

const normalizeImage = (src?: string | null): string =>
  !src || !src.trim()
    ? '/assets/prince-foods-logo.png'
    : src.startsWith('//')
      ? `https:${src}`
      : src;

const poundsToPence = (n: number) => Math.round(n * 100);

export default function ProductCard({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const add = useCart((s) => s.add);
  const open = useCart((s) => s.open);

  const img = normalizeImage(product.imageUrl);
  const change = (v: number) => setQty((n) => Math.max(1, n + v));
  const set = (v: number) => setQty(Math.max(1, v || 1));

  const handleAdd = () => {
    add({
      id: product.id, // must be unique
      productId: product.id,
      name: product.title,
      image: img,
      imageUrl: img,
      unitPrice: poundsToPence(product.price), // pence for the store
      quantity: qty
    });
    open(); // open basket drawer
  };

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
      </div>

      <h3 className={s.title}>{product.title}</h3>

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
    </article>
  );
}
