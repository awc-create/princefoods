'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import styles from './CartDrawer.module.scss';

export default function CartDrawer() {
  const {
    items,
    isOpen,
    toggle,
    updateQty,
    remove,
    subtotal,
    displayQty,
    freeQty,
    refreshOffers,
    offers,
    offerNames
  } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    void refreshOffers();
  }, [isOpen, refreshOffers]);

  const hasAnyOffer = (offers.applied?.length ?? 0) > 0 || (offers.autoAdd?.length ?? 0) > 0;

  if (!isOpen) return null;

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
          {items.map((it) => {
            const dispQty = displayQty(it.id);
            const free = freeQty(it.id);
            const names = offerNames(it.id);

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

                  {it.sku ? <div className={styles.sku}>{it.sku}</div> : null}

                  <div className={styles.unit}>{penceToGBP(it.unitPrice)}</div>

                  {/* ✅ Offer name(s) (plain text) */}
                  {names.length > 0 ? (
                    <div className={styles.offerText} title={names.join(', ')}>
                      Offer: <strong>{names.join(' • ')}</strong>
                    </div>
                  ) : null}

                  {/* ✅ Free items hint */}
                  {free > 0 ? (
                    <div className={styles.freeHint}>
                      Includes <strong>{free}</strong> free item{free === 1 ? '' : 's'}
                    </div>
                  ) : null}
                </div>

                <div className={styles.qtyRow}>
                  <button onClick={() => updateQty(it.id, it.quantity - 1)} aria-label="Decrease">
                    −
                  </button>

                  {/* ✅ show PAID+FREE qty */}
                  <span
                    className={styles.qty}
                    title={free > 0 ? `Paid ${it.quantity} + Free ${free}` : undefined}
                  >
                    {dispQty}
                  </span>

                  <button onClick={() => updateQty(it.id, it.quantity + 1)} aria-label="Increase">
                    +
                  </button>
                </div>

                {/* ✅ paid total only */}
                <div className={styles.lineTotal}>{penceToGBP(it.unitPrice * it.quantity)}</div>

                <button className={styles.remove} onClick={() => remove(it.id)} aria-label="Remove">
                  ×
                </button>
              </li>
            );
          })}

          {items.length === 0 && <li className={styles.empty}>Your basket is empty.</li>}
        </ul>

        <div className={styles.summary}>
          <span>Subtotal</span>
          <strong>{penceToGBP(subtotal())}</strong>
        </div>

        {hasAnyOffer && (
          <div style={{ padding: '0 16px 12px', color: '#6b7280', fontSize: 12 }}>
            🎁 Offers available
            {offers.discountPence > 0 ? <> ({penceToGBP(offers.discountPence)} off)</> : null}
          </div>
        )}

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
