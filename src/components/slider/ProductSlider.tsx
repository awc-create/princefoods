'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './ProductSlider.module.scss';

export interface SliderProduct {
  id: string;
  name: string;
  price: number | null;
  productImageUrl: string | null;
}

type Props = {
  title: string;
  products: SliderProduct[];
  initialVisible?: number; // default 4
};

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const normalizeImage = (src: string | null | undefined): string => {
  if (!src) return '/assets/prince-foods-logo.png';
  let s = src.trim();
  if (s.startsWith('//')) s = `https:${s}`;
  if (/^https?:\/\//i.test(s)) return s;
  // if you store relative names in DB, serve from /images
  return `/images/${s.replace(/^\/+/, '')}`;
};

export default function ProductSlider({ title, products, initialVisible = 4 }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>(
    () => Object.fromEntries(products.map((p) => [p.id, 1]))
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(initialVisible);
  const [currentIndex, setCurrentIndex] = useState(0);

  // responsive visible count
  const computeVisible = useCallback((w: number) => {
    if (w < 520) return 1;
    if (w < 820) return 2;
    if (w < 1120) return 3;
    return initialVisible;
  }, [initialVisible]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setVisibleCount(computeVisible(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeVisible]);

  useEffect(() => {
    // clamp index when list/visible changes
    const maxStart = Math.max(0, products.length - visibleCount);
    setCurrentIndex((i) => Math.min(i, maxStart));
  }, [products.length, visibleCount]);

  const updateQty = (id: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [id]: Math.max(1, (prev[id] || 1) + delta),
    }));
  };

  const canPrev = currentIndex > 0;
  const canNext = currentIndex + visibleCount < products.length;

  const windowed = useMemo(
    () => products.slice(currentIndex, currentIndex + visibleCount),
    [products, currentIndex, visibleCount]
  );

  return (
    <div className={styles.sliderWrapper} ref={containerRef}>
      <h2 className={styles.heading}>{title}</h2>

      <div className={styles.carousel}>
        {canPrev && (
          <button className={styles.arrow} onClick={() => setCurrentIndex((i) => Math.max(0, i - visibleCount))} aria-label="Previous">
            ‹
          </button>
        )}

        <div className={styles.cards}>
          {windowed.map((product) => {
            const src = normalizeImage(product.productImageUrl);
            const price = product.price != null ? GBP.format(product.price) : '—';
            return (
              <div key={product.id} className={styles.card}>
                <div className={styles.imageSection}>
                  <Image
                    src={src}
                    alt={product.name}
                    width={300}
                    height={300}
                    sizes="(max-width: 520px) 90vw, (max-width: 820px) 45vw, (max-width: 1120px) 30vw, 300px"
                    priority={false}
                  />
                </div>

                <div className={styles.details}>
                  <p className={styles.name}>{product.name}</p>
                  <p className={styles.price}>{price}</p>

                  <div className={styles.hoverActions}>
                    <div className={styles.qtyControl}>
                      <button onClick={() => updateQty(product.id, -1)} aria-label="Decrease quantity">-</button>
                      <span>{quantities[product.id] || 1}</span>
                      <button onClick={() => updateQty(product.id, 1)} aria-label="Increase quantity">+</button>
                    </div>
                    <button className={styles.quickView}>Quick View</button>
                    <button className={styles.addToCart}>Add to Cart</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {canNext && (
          <button className={styles.arrow} onClick={() => setCurrentIndex((i) => i + visibleCount)} aria-label="Next">
            ›
          </button>
        )}
      </div>
    </div>
  );
}

export type { SliderProduct as Product };
