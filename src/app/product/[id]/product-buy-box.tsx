'use client';

import { useCart } from '@/lib/cart-store';
import { motion, useAnimation } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import s from './product.module.scss';

type DiscountMode = string | null;
type DealMeta =
  | { mode: 'PERCENT_OFF'; percent: number }
  | { mode: 'AMOUNT_OFF'; amountPence: number }
  | null;

interface PDPProduct {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
  sku: string | null;
  inventory: number | null;
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
const penceToGBP = (p: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(p / 100);

const track = (payload: unknown) =>
  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});

function computeDealPrice(basePrice: number, deal: DealMeta) {
  const wasPence = poundsToPence(basePrice);
  if (!deal) return { hasDiscount: false, nowPence: wasPence, wasPence };
  if (deal.mode === 'PERCENT_OFF') {
    const pct = Math.max(0, Math.min(100, Math.trunc(deal.percent ?? 0)));
    if (pct <= 0) return { hasDiscount: false, nowPence: wasPence, wasPence };
    const nowPence = Math.max(0, Math.round(wasPence * (1 - pct / 100)));
    return { hasDiscount: nowPence < wasPence, nowPence, wasPence };
  }
  if (deal.mode === 'AMOUNT_OFF') {
    const off = Math.max(0, Math.trunc(deal.amountPence ?? 0));
    if (off <= 0) return { hasDiscount: false, nowPence: wasPence, wasPence };
    const nowPence = Math.max(0, wasPence - off);
    return { hasDiscount: nowPence < wasPence, nowPence, wasPence };
  }
  return { hasDiscount: false, nowPence: wasPence, wasPence };
}

export default function ProductBuyBox({ product }: { product: PDPProduct }) {
  const [qty, setQty] = useState(1);
  const [deal, setDeal] = useState<DealMeta>(null);
  const [offerBadges, setOfferBadges] = useState<string[]>([]);
  const [added, setAdded] = useState(false);

  const add = useCart((st) => st.add);
  const open = useCart((st) => st.open);
  const img = normalizeImage(product.imageUrl);
  const btnControls = useAnimation();

  // Fetch live offer deal + badges
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/offers/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: [product.id] })
        });
        const data = (await res.json()) as {
          badges?: Record<string, string[]>;
          deals?: Record<string, DealMeta>;
        };
        if (cancelled) return;
        setDeal(data.deals?.[product.id] ?? null);
        setOfferBadges(data.badges?.[product.id] ?? []);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const { hasDiscount, nowPence, wasPence } = useMemo(
    () => computeDealPrice(product.price, deal),
    [product.price, deal]
  );

  const badges = useMemo(() => {
    const list: string[] = [...offerBadges];
    if (product.ribbon?.trim() && !list.includes(product.ribbon.trim())) {
      list.unshift(product.ribbon.trim());
    }
    return [...new Set(list)].slice(0, 3);
  }, [offerBadges, product.ribbon]);

  const inStock = product.inventory == null ? true : product.inventory > 0;
  const lowStock = product.inventory != null && product.inventory > 0 && product.inventory <= 5;

  const change = (v: number) => setQty((n) => Math.max(1, Math.min(99, n + v)));

  const handleAdd = async () => {
    if (!inStock) return;
    add({
      id: product.id,
      productId: product.id,
      sku: product.sku,
      name: product.title,
      image: img,
      imageUrl: img,
      unitPrice: hasDiscount ? nowPence : poundsToPence(product.price),
      quantity: qty
    });

    // Animate button
    setAdded(true);
    await btnControls.start({ scale: [1, 0.96, 1.02, 1], transition: { duration: 0.3 } });
    setTimeout(() => {
      open();
      setAdded(false);
    }, 600);

    track({ type: 'product_click', productId: product.id, action: 'add_to_cart' });
  };

  return (
    <motion.div
      className={s.buyBox}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      {/* Live price */}
      <motion.div
        className={s.livePrice}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {hasDiscount ? (
          <>
            <span className={s.priceNow}>{penceToGBP(nowPence)}</span>
            <span className={s.priceWas}>{penceToGBP(wasPence)}</span>
            <span className={s.saveBadge}>Save {penceToGBP(wasPence - nowPence)}</span>
          </>
        ) : (
          <span className={s.priceNow}>{penceToGBP(poundsToPence(product.price))}</span>
        )}
      </motion.div>

      {/* Offer badges */}
      {badges.length > 0 && (
        <motion.div
          className={s.badges}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
        >
          {badges.map((b) => (
            <span key={`${product.id}:${b}`} className={s.pill}>
              {b}
            </span>
          ))}
        </motion.div>
      )}

      {/* Qty + Add to Cart */}
      <motion.div
        className={s.buyRow}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        {/* Qty stepper */}
        <div className={s.qty}>
          <button
            type="button"
            onClick={() => change(-1)}
            aria-label="Decrease quantity"
            disabled={qty <= 1}
          >
            −
          </button>
          <span className={s.qtyNum} aria-live="polite" aria-label={`Quantity: ${qty}`}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => change(1)}
            aria-label="Increase quantity"
            disabled={qty >= 99}
          >
            +
          </button>
        </div>

        {/* Add to Cart */}
        <motion.button
          type="button"
          className={`${s.add} ${added ? s.addDone : ''}`}
          onClick={handleAdd}
          disabled={!inStock}
          animate={btnControls}
          whileTap={inStock ? { scale: 0.97 } : {}}
        >
          {!inStock ? 'Out of Stock' : added ? '✓ Added!' : 'Add to Cart'}
        </motion.button>
      </motion.div>

      {lowStock && (
        <motion.p
          className={s.stockNote}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Only {product.inventory} left — order soon.
        </motion.p>
      )}
    </motion.div>
  );
}
