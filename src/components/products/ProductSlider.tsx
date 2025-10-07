'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ProductSlider.module.scss';

interface Product {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
}

const priceStr = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

// 🔒 Force the same test image for every product (lives under /public/assets/…)
const TEST_IMG = '/assets/96bfc4_3a3fd4d7b9824b31a86d7d873dff083a~mv2.jpeg';
const imgPath = (_img: string | null) => TEST_IMG;

export default function ProductSlider({ title, products }: { title: string; products: Product[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  // qty per product
  const [qty, setQty] = useState<Record<string, number>>({});
  const inc = (id: string) => setQty((q) => ({ ...q, [id]: Math.min((q[id] ?? 1) + 1, 99) }));
  const dec = (id: string) => setQty((q) => ({ ...q, [id]: Math.max((q[id] ?? 1) - 1, 1) }));

  // drag-to-scroll
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [, setTick] = useState(0); // re-render to refresh arrow disabled state

  const canPrev = () => !!trackRef.current && trackRef.current.scrollLeft > 0;
  const canNext = () =>
    !!trackRef.current &&
    trackRef.current.scrollLeft + trackRef.current.clientWidth < trackRef.current.scrollWidth - 2;

  const scrollByCards = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      setDragging(true);
      setStartX(e.pageX - el.getBoundingClientRect().left);
      setScrollLeft(el.scrollLeft);
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const x = e.pageX - el.getBoundingClientRect().left;
      el.scrollLeft = scrollLeft - (x - startX) * 1.1;
    };
    const onUp = (e: PointerEvent) => {
      setDragging(false);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {}
    };
    const onScroll = () => setTick((t) => (t + 1) % 1000);

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('scroll', onScroll);
    };
  }, [dragging, startX, scrollLeft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const hover = trackRef.current?.matches(':hover,:focus-within');
      if (!hover) return;
      if (e.key === 'ArrowRight') scrollByCards(1);
      if (e.key === 'ArrowLeft') scrollByCards(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scrollByCards]);

  return (
    <section className={styles.sliderWrapper} aria-labelledby="pf-best-sellers">
      <h2 id="pf-best-sellers" className={styles.heading}>
        {title}
      </h2>

      <div className={styles.carousel}>
        <button
          className={styles.arrow}
          onClick={() => scrollByCards(-1)}
          aria-label="Previous products"
          disabled={!canPrev()}
          type="button"
        >
          ‹
        </button>

        <div className={styles.track} ref={trackRef} tabIndex={0} aria-label="Product list">
          {products.map((p) => {
            const q = qty[p.id] ?? 1;
            return (
              <article key={p.id} className={styles.card} role="listitem">
                {/* TOP mini-card — image + name + price */}
                <div className={styles.topCard}>
                  <div className={styles.imageSection}>
                    <Image
                      src={imgPath(p.productImageUrl)}
                      alt={p.name}
                      fill
                      sizes="(max-width: 520px) 90vw, (max-width: 1160px) 45vw, 300px"
                      style={{ objectFit: 'contain', objectPosition: 'center' }}
                      priority={false}
                    />
                  </div>

                  <div className={styles.details}>
                    <p className={styles.name} title={p.name}>
                      {p.name}
                    </p>
                    <p className={styles.price}>{priceStr(p.price)}</p>
                  </div>
                </div>

                {/* BOTTOM mini-card — qty + actions */}
                <div className={styles.bottomCard} tabIndex={0}>
                  <div className={styles.qty}>
                    <button aria-label="Decrease quantity" onClick={() => dec(p.id)} type="button">
                      –
                    </button>
                    <span>{q}</span>
                    <button aria-label="Increase quantity" onClick={() => inc(p.id)} type="button">
                      +
                    </button>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.btnGhost}
                      type="button"
                      aria-label={`Quick view ${p.name}`}
                    >
                      Quick View
                    </button>
                    <button
                      className={styles.btnPrimary}
                      type="button"
                      aria-label={`Add ${p.name} to cart`}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <button
          className={styles.arrow}
          onClick={() => scrollByCards(1)}
          aria-label="Next products"
          disabled={!canNext()}
          type="button"
        >
          ›
        </button>
      </div>
    </section>
  );
}
