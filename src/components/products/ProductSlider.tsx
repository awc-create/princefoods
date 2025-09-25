'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './ProductSlider.module.scss';

interface Product {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
}

const priceStr = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n || 0);

export default function ProductSlider({ title, products }: { title: string; products: Product[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const cols = useMemo(() => {
    if (typeof window === 'undefined') return 4;
    const w = window.innerWidth;
    if (w < 520) return 1;
    if (w < 820) return 2;
    if (w < 1160) return 3;
    return 4;
  }, []);

  const canPrev = () => !!trackRef.current && trackRef.current.scrollLeft > 0;
  const canNext = () =>
    !!trackRef.current &&
    trackRef.current.scrollLeft + trackRef.current.clientWidth < trackRef.current.scrollWidth - 2;

  const scrollByCards = useCallback(
    (dir: 1 | -1) => {
      const el = trackRef.current;
      if (!el) return;
      const card = el.querySelector<HTMLElement>('[data-card]');
      const delta = card ? card.offsetWidth + 16 : el.clientWidth / cols;
      el.scrollBy({ left: dir * delta * cols, behavior: 'smooth' });
    },
    [cols]
  );

  // Dragging
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      setDragging(true);
      setStartX(e.pageX - el.offsetLeft);
      setScrollLeft(el.scrollLeft);
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.1;
      el.scrollLeft = scrollLeft - walk;
    };
    const onUp = (e: PointerEvent) => {
      setDragging(false);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, startX, scrollLeft]);

  // Keyboard arrows when focused/hovered
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

  const imgPath = (img: string | null) =>
    !img
      ? '/assets/prince-foods-logo.png'
      : /^https?:\/\//i.test(img)
        ? img
        : `/images/${img.replace(/^\/+/, '')}`;

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
        >
          ‹
        </button>

        <div className={styles.track} ref={trackRef} tabIndex={0} aria-label="Product list">
          {products.map((p) => (
            <article key={p.id} className={styles.card} data-card role="listitem">
              <div className={styles.imageSection}>
                <Image
                  src={imgPath(p.productImageUrl)}
                  alt={p.name}
                  width={300}
                  height={300}
                  sizes="(max-width: 520px) 80vw, (max-width: 1160px) 30vw, 300px"
                />
              </div>

              <div className={styles.details}>
                <p className={styles.name} title={p.name}>
                  {p.name}
                </p>
                <p className={styles.price}>{priceStr(p.price)}</p>

                <div className={styles.actions}>
                  <button className={styles.btnGhost} aria-label={`Quick view ${p.name}`}>
                    Quick View
                  </button>
                  <button className={styles.btnPrimary} aria-label={`Add ${p.name} to cart`}>
                    Add to Cart
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <button
          className={styles.arrow}
          onClick={() => scrollByCards(1)}
          aria-label="Next products"
          disabled={!canNext()}
        >
          ›
        </button>
      </div>
    </section>
  );
}
