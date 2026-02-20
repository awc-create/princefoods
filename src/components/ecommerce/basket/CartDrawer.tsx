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
    offerNames,
    offerDiscountForLine
  } = useCart();

  useEffect(() => {
    if (!isOpen) return;
    void refreshOffers();
  }, [isOpen, refreshOffers]);

  const hasAnyOffer = (offers.applied?.length ?? 0) > 0 || (offers.autoAdd?.length ?? 0) > 0;

  const paidSubtotal = Math.max(0, Math.trunc(subtotal()));
  const offerDiscount = Math.max(0, Math.trunc(offers.discountPence ?? 0));
  const totalAfterOffers = Math.max(0, paidSubtotal - offerDiscount);

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
            const paidQty = Math.max(1, Math.trunc(it.quantity));
            const dispQty = Math.max(1, Math.trunc(displayQty(it.id)));
            const free = Math.max(0, Math.trunc(freeQty(it.id)));
            const names = offerNames(it.id);

            const unit = Math.max(0, Math.trunc(it.unitPrice));
            const paidTotal = unit * paidQty;
            const fullTotal = unit * (paidQty + free);

            const lineOfferDiscount = Math.max(0, Math.trunc(offerDiscountForLine(it.id) ?? 0));
            const discountedNow = Math.max(0, paidTotal - lineOfferDiscount);

            const showWasBogof = free > 0 && fullTotal > paidTotal;
            const showWasDiscount =
              free === 0 && lineOfferDiscount > 0 && discountedNow < paidTotal;

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

                  {/* Offer name(s) */}
                  {names.length > 0 ? (
                    <div className={styles.offerText} title={names.join(', ')}>
                      Offer: <strong>{names.join(' • ')}</strong>
                    </div>
                  ) : null}

                  {/* Free items hint */}
                  {free > 0 ? (
                    <div className={styles.freeHint}>
                      Includes <strong>{free}</strong> free item{free === 1 ? '' : 's'}
                    </div>
                  ) : null}

                  {/* Per-line discount hint */}
                  {lineOfferDiscount > 0 ? (
                    <div className={styles.offerText}>
                      Offer applied: <strong>-{penceToGBP(lineOfferDiscount)}</strong>
                    </div>
                  ) : null}
                </div>

                <div className={styles.qtyRow}>
                  <button onClick={() => updateQty(it.id, paidQty - 1)} aria-label="Decrease">
                    −
                  </button>

                  <span
                    className={styles.qty}
                    title={free > 0 ? `Paid ${paidQty} + Free ${free}` : undefined}
                  >
                    {dispQty}
                  </span>

                  <button onClick={() => updateQty(it.id, paidQty + 1)} aria-label="Increase">
                    +
                  </button>
                </div>

                {/* ✅ line total: Was / Now */}
                <div className={styles.lineTotal}>
                  {showWasBogof ? (
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 2 }}>
                      <span style={{ textDecoration: 'line-through', opacity: 0.65, fontSize: 12 }}>
                        Was {penceToGBP(fullTotal)}
                      </span>
                      <span>Now {penceToGBP(paidTotal)}</span>
                    </div>
                  ) : showWasDiscount ? (
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 2 }}>
                      <span style={{ textDecoration: 'line-through', opacity: 0.65, fontSize: 12 }}>
                        Was {penceToGBP(paidTotal)}
                      </span>
                      <span>Now {penceToGBP(discountedNow)}</span>
                    </div>
                  ) : (
                    penceToGBP(paidTotal)
                  )}
                </div>

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
          <strong>{penceToGBP(paidSubtotal)}</strong>
        </div>

        {offerDiscount > 0 && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#16a34a', fontSize: 12 }}>Offers</span>
              <span style={{ color: '#16a34a', fontSize: 12 }}>-{penceToGBP(offerDiscount)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>Total</span>
              <span>{penceToGBP(totalAfterOffers)}</span>
            </div>
          </div>
        )}

        {hasAnyOffer && offerDiscount === 0 && (
          <div style={{ padding: '0 16px 12px', color: '#6b7280', fontSize: 12 }}>
            🎁 Offers available
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
