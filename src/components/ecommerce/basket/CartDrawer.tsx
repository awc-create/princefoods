'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './CartDrawer.module.scss';

interface BogofRule {
  buyQty: number;
  getQty: number;
}

export default function CartDrawer() {
  const { items, isOpen, toggle, updateQty, remove } = useCart();

  const [badges, setBadges] = useState<Record<string, string[]>>({});
  const [bogof, setBogof] = useState<Record<string, BogofRule>>({});

  // Fetch offer data whenever drawer opens or items change
  const itemsKey = items.map((i) => `${i.productId ?? i.id}:${i.quantity}`).join('|');
  useEffect(() => {
    if (!isOpen || !items.length) return;
    const ids = [...new Set(items.map((i) => i.productId ?? i.id).filter(Boolean))];
    fetch('/api/offers/badges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: ids })
    })
      .then((r) => r.json())
      .then((d: { badges?: Record<string, string[]>; bogof?: Record<string, BogofRule> }) => {
        setBadges(d.badges ?? {});
        setBogof(d.bogof ?? {});
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, itemsKey]);

  if (!isOpen) return null;

  // Compute totals with local BOGOF math
  let subtotalPence = 0;
  let fullPricePence = 0; // what it would cost without the free items

  const lineData = items.map((it) => {
    const productId = it.productId ?? it.id;
    const rule = bogof[productId];
    const paidQty = Math.max(1, Math.trunc(it.quantity));
    const unitPence = Math.max(0, Math.trunc(it.unitPrice));

    let freeQty = 0;
    if (rule) {
      const groups = Math.floor(paidQty / rule.buyQty);
      freeQty = groups * rule.getQty;
    }

    const totalQty = paidQty + freeQty;
    const paidPence = unitPence * paidQty;
    const fullPence = unitPence * totalQty; // what you'd pay without offer

    subtotalPence += paidPence;
    fullPricePence += fullPence;

    return { it, paidQty, freeQty, totalQty, unitPence, paidPence, fullPence, rule };
  });

  const savedPence = fullPricePence - subtotalPence;

  return (
    <aside className={styles.host} aria-modal="true" role="dialog" aria-label="Basket">
      <div className={styles.backdrop} onClick={toggle} />
      <div className={styles.panel}>
        <header className={styles.header}>
          <h3>Basket</h3>
          <button onClick={toggle} aria-label="Close basket">
            ×
          </button>
        </header>

        <ul className={styles.list}>
          {lineData.map(
            ({ it, paidQty, freeQty, totalQty, unitPence, paidPence, fullPence, rule }) => {
              const productId = it.productId ?? it.id;
              const productBadges = badges[productId] ?? [];

              return (
                <li key={it.id} className={styles.line}>
                  <div className={styles.thumb}>
                    {it.image ? (
                      <Image src={it.image} alt={it.name} width={56} height={56} />
                    ) : (
                      <div className={styles.ph} />
                    )}
                  </div>

                  <div className={styles.meta}>
                    <div className={styles.name} title={it.name}>
                      {it.name}
                    </div>
                    <div className={styles.unit}>{penceToGBP(unitPence)} each</div>

                    {/* Offer badges */}
                    {productBadges.length > 0 && (
                      <div className={styles.badgeRow}>
                        {productBadges.map((b) => (
                          <span key={b} className={styles.offerBadge}>
                            {b}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Free item tag — appears once threshold is met */}
                    {freeQty > 0 && <div className={styles.freeTag}>🎁 {freeQty} free!</div>}

                    {/* How many more needed to unlock */}
                    {rule && freeQty === 0 && (
                      <div className={styles.nudge}>
                        Add {rule.buyQty - (paidQty % rule.buyQty)} more for a free one
                      </div>
                    )}
                  </div>

                  <div className={styles.qtyRow}>
                    <button
                      onClick={() => (paidQty <= 1 ? remove(it.id) : updateQty(it.id, paidQty - 1))}
                      aria-label={paidQty <= 1 ? 'Remove' : 'Decrease'}
                    >
                      −
                    </button>
                    <span className={styles.qty}>
                      {totalQty}
                      {freeQty > 0 && (
                        <span className={styles.qtyFreeNote}>
                          {' '}
                          ({paidQty}+{freeQty})
                        </span>
                      )}
                    </span>
                    <button onClick={() => updateQty(it.id, paidQty + 1)} aria-label="Increase">
                      +
                    </button>
                  </div>

                  {/* Price: if free items, show was/now */}
                  <div className={styles.lineTotal}>
                    {freeQty > 0 ? (
                      <div className={styles.wasnow}>
                        <span className={styles.was}>{penceToGBP(fullPence)}</span>
                        <span className={styles.now}>{penceToGBP(paidPence)}</span>
                      </div>
                    ) : (
                      penceToGBP(paidPence)
                    )}
                  </div>

                  <button
                    className={styles.remove}
                    onClick={() => remove(it.id)}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </li>
              );
            }
          )}

          {items.length === 0 && <li className={styles.empty}>Your basket is empty.</li>}
        </ul>

        {/* Summary */}
        {savedPence > 0 && (
          <div className={styles.savingsBanner}>
            🎉 You're saving {penceToGBP(savedPence)} with offers!
          </div>
        )}

        <div className={styles.summary}>
          <span>Subtotal</span>
          <div className={styles.summaryPrice}>
            {savedPence > 0 && (
              <span className={styles.summaryWas}>{penceToGBP(fullPricePence)}</span>
            )}
            <strong className={savedPence > 0 ? styles.summaryNow : undefined}>
              {penceToGBP(subtotalPence)}
            </strong>
          </div>
        </div>

        <p style={{ padding: '0 16px 8px', margin: 0, fontSize: 12, color: '#9ca3af' }}>
          + Shipping calculated at checkout
        </p>

        <footer className={styles.footer}>
          <Link href="/cart" onClick={toggle} className={styles.linkBtn}>
            View basket
          </Link>
          <Link href="/checkout" onClick={toggle} className={styles.primaryBtn}>
            Checkout
          </Link>
        </footer>
      </div>
    </aside>
  );
}
