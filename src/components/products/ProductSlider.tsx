'use client';

import { useCart } from '@/lib/cart-store';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ProductSlider.module.scss';

interface Product {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
  ribbon?: string | null;
  discountMode?: string | null;
  discountValue?: number | null;
}

type DealMeta =
  | { mode: 'PERCENT_OFF'; percent: number }
  | { mode: 'AMOUNT_OFF'; amountPence: number }
  | null;

interface BadgesResponse {
  ok?: boolean;
  badges?: Record<string, string[]>;
  deals?: Record<string, DealMeta>;
}

const normalizeImage = (src?: string | null): string =>
  !src || !src.trim()
    ? '/assets/prince-foods-logo.png'
    : src.startsWith('//')
      ? `https:${src}`
      : src;

const poundsToPence = (n: number) => Math.round((n ?? 0) * 100);
const priceStr = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n ?? 0);

const track = (payload: unknown) =>
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});

function computeDealPrice(basePrice: number, deal: DealMeta) {
  if (!deal) return null;
  const base = Number.isFinite(basePrice) ? basePrice : 0;
  if (base <= 0) return null;
  if (deal.mode === 'PERCENT_OFF') {
    const pct = Math.max(0, Math.min(100, Math.trunc(deal.percent ?? 0)));
    if (pct <= 0) return null;
    const now = +(base * (1 - pct / 100)).toFixed(2);
    return now < base ? { now, was: base } : null;
  }
  if (deal.mode === 'AMOUNT_OFF') {
    const off = Math.max(0, Math.trunc(deal.amountPence ?? 0));
    if (off <= 0) return null;
    const now = +Math.max(0, base - off / 100).toFixed(2);
    return now < base ? { now, was: base } : null;
  }
  return null;
}

export default function ProductSlider({
  title,
  products,
  subtitle
}: {
  title: string;
  subtitle?: string | null;
  products: Product[];
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const add = useCart((st) => st.add);
  const open = useCart((st) => st.open);
  const [qty, setQty] = useState<Record<string, number>>({});
  const inc = (id: string) => setQty((q) => ({ ...q, [id]: Math.min((q[id] ?? 1) + 1, 99) }));
  const dec = (id: string) => setQty((q) => ({ ...q, [id]: Math.max((q[id] ?? 1) - 1, 1) }));
  const [badgesById, setBadgesById] = useState<Record<string, string[]>>({});
  const [dealsById, setDealsById] = useState<Record<string, DealMeta>>({});
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, scrollLeft: 0 });

  const scrollByCards = useCallback((dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    if (dir === 1 && el.scrollLeft >= maxLeft - 1) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (dir === -1 && el.scrollLeft <= 1) {
      el.scrollTo({ left: maxLeft, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
    }
  }, []);

  const handleAdd = (p: Product, quantity: number) => {
    const img = normalizeImage(p.productImageUrl);
    add({
      id: p.id,
      productId: p.id,
      name: p.name,
      image: img,
      imageUrl: img,
      unitPrice: poundsToPence(p.price),
      quantity
    });
    open();
    track({ type: 'product_click', productId: p.id, action: 'add_to_cart' });
  };

  useEffect(() => {
    let cancelled = false;
    const ids = (products ?? []).map((p) => p.id).filter(Boolean);
    if (!ids.length) return;
    (async () => {
      try {
        const res = await fetch('/api/offers/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: ids })
        });
        const data = (await res.json().catch(() => ({}))) as BadgesResponse;
        if (cancelled) return;
        setBadgesById(data.badges ?? {});
        setDealsById(data.deals ?? {});
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [products]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      setDragging(true);
      dragRef.current = { startX: e.pageX, scrollLeft: el.scrollLeft };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      el.scrollLeft = dragRef.current.scrollLeft - (e.pageX - dragRef.current.startX);
    };
    const onUp = (e: PointerEvent) => {
      setDragging(false);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ok */
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
  }, [dragging]);

  const sliderId = `pf-slider-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <section className={styles.sliderWrapper} aria-labelledby={sliderId}>
      <motion.div
        className={styles.headingRow}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <span className={styles.eyebrow}>🛒 Shop</span>
        <h2 id={sliderId} className={styles.heading}>
          {title}
        </h2>
        {subtitle && <p className={styles.subheading}>{subtitle}</p>}
      </motion.div>

      <div className={styles.carousel}>
        <div className={styles.arrowRow}>
          <button
            className={styles.arrow}
            onClick={() => scrollByCards(-1)}
            aria-label="Previous"
            type="button"
          >
            ‹
          </button>
          <button
            className={styles.arrow}
            onClick={() => scrollByCards(1)}
            aria-label="Next"
            type="button"
          >
            ›
          </button>
        </div>

        <div className={styles.track} ref={trackRef} tabIndex={0}>
          {products.map((p, i) => {
            const q = qty[p.id] ?? 1;
            const img = normalizeImage(p.productImageUrl);
            const badges = badgesById[p.id] ?? [];
            const deal = dealsById[p.id] ?? null;
            const dealPrice = computeDealPrice(p.price, deal);

            return (
              <motion.article
                key={p.id}
                className={styles.card}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: i * 0.06, ease: 'easeOut' }}
              >
                <div className={styles.imageSection}>
                  {badges.length > 0 && (
                    <div className={styles.badgeStack}>
                      {badges.slice(0, 2).map((b) => (
                        <span key={b} className={styles.badge}>
                          {b}
                        </span>
                      ))}
                      {badges.length > 2 && (
                        <span className={styles.badgeSoft}>+{badges.length - 2}</span>
                      )}
                    </div>
                  )}
                  <Link
                    href={`/product/${p.id}`}
                    aria-label={p.name}
                    onClick={() =>
                      track({ type: 'product_click', productId: p.id, action: 'view' })
                    }
                    className={styles.imageLink}
                  />
                  <Image
                    src={img}
                    alt={p.name}
                    fill
                    sizes="(max-width: 520px) 78vw, (max-width: 820px) 45vw, (max-width: 1160px) 30vw, 280px"
                    style={{ objectFit: 'contain', objectPosition: 'center' }}
                    priority={false}
                  />
                </div>

                <div className={styles.details}>
                  <p className={styles.name} title={p.name}>
                    {p.name}
                  </p>
                  {dealPrice ? (
                    <div className={styles.priceDealRow}>
                      <span className={styles.priceNow}>{priceStr(dealPrice.now)}</span>
                      <span className={styles.priceWas}>{priceStr(dealPrice.was)}</span>
                    </div>
                  ) : (
                    <p className={styles.price}>{priceStr(p.price)}</p>
                  )}
                </div>

                <div className={styles.bottomCard}>
                  <div className={styles.qty}>
                    <button aria-label="Decrease" onClick={() => dec(p.id)} type="button">
                      –
                    </button>
                    <span>{q}</span>
                    <button aria-label="Increase" onClick={() => inc(p.id)} type="button">
                      +
                    </button>
                  </div>
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    aria-label={`Add ${p.name} to cart`}
                    onClick={() => handleAdd(p, q)}
                  >
                    Add to Cart
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
