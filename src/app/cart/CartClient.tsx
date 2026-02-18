'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect } from 'react';
import styles from './cart.module.scss';

export default function CartClient() {
  const {
    items,
    updateQty,
    remove,
    subtotal,
    clear,
    offers,
    refreshOffers,
    displayQty,
    freeQty,
    offerNames
  } = useCart();

  // ✅ keep offers/freeQty in sync on this page too
  useEffect(() => {
    void refreshOffers();
  }, [refreshOffers, items.length]); // lightweight trigger

  const hasOffersApplied = (offers.applied?.length ?? 0) > 0;
  const hasOffersAutoAdd = (offers.autoAdd?.length ?? 0) > 0;
  const hasAnyOffer = hasOffersApplied || hasOffersAutoAdd;

  if (items.length === 0) {
    return (
      <main className={styles.shell}>
        <h1>Basket</h1>
        <p>Your basket is empty.</p>
        <Link className={styles.btn} href="/shop">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <h1>Basket</h1>

      <div className={styles.grid}>
        <section className={styles.lines}>
          <ul className={styles.list}>
            {items.map((it) => {
              const paidQty = Math.max(1, Math.trunc(it.quantity));
              const free = Math.max(0, Math.trunc(freeQty(it.id)));
              const shownQty = Math.max(1, Math.trunc(displayQty(it.id)));

              const unit = Math.max(0, Math.trunc(it.unitPrice));
              const paidTotal = unit * paidQty;

              const names = offerNames(it.id);
              const showOfferNames = names.length > 0;

              return (
                <li key={it.id} className={styles.line}>
                  <div className={styles.thumb}>
                    {it.image ? (
                      <Image src={it.image} alt={it.name} width={72} height={72} />
                    ) : (
                      <div className={styles.ph} />
                    )}
                  </div>

                  <div className={styles.meta}>
                    <div className={styles.name}>{it.name}</div>

                    {it.sku ? <div className={styles.sku}>{it.sku}</div> : null}

                    <div className={styles.price}>{penceToGBP(it.unitPrice)}</div>

                    {/* ✅ Offer name(s) (no pill) */}
                    {showOfferNames ? (
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
                    {/* ✅ buttons change PAID qty, but we DISPLAY paid+free */}
                    <button
                      onClick={() => updateQty(it.id, paidQty - 1)}
                      aria-label="Decrease"
                      disabled={paidQty <= 1}
                      title={paidQty <= 1 ? 'Use remove' : 'Decrease'}
                    >
                      <Minus />
                    </button>

                    <span
                      className={styles.qty}
                      title={free > 0 ? `Paid ${paidQty} + Free ${free}` : undefined}
                    >
                      {shownQty}
                    </span>

                    <button onClick={() => updateQty(it.id, paidQty + 1)} aria-label="Increase">
                      <Plus />
                    </button>
                  </div>

                  {/* ✅ price stays PAID only */}
                  <div className={styles.lineTotal}>{penceToGBP(paidTotal)}</div>

                  <button
                    className={styles.remove}
                    onClick={() => remove(it.id)}
                    aria-label="Remove"
                  >
                    <Trash2 />
                  </button>
                </li>
              );
            })}
          </ul>

          <button className={styles.clear} onClick={clear}>
            Clear basket
          </button>
        </section>

        <aside className={styles.summary}>
          <h3>Summary</h3>

          <div className={styles.row}>
            <span>Subtotal</span>
            <span>{penceToGBP(subtotal())}</span>
          </div>

          {/* ✅ OFFERS (now from store, same as drawer/checkout behaviour) */}
          {hasAnyOffer ? (
            <div style={{ marginTop: 8 }}>
              <p className={styles.muted}>
                🎁 Offers available
                {offers.discountPence > 0 ? (
                  <> ({penceToGBP(offers.discountPence)} off)</>
                ) : null} • <strong>Applied</strong>
              </p>

              {hasOffersApplied ? (
                <ul className={styles.muted} style={{ margin: '6px 0 6px', paddingLeft: 18 }}>
                  {offers.applied.map((a) => (
                    <li key={`${a.offerId}:${a.kind}`}>
                      {a.name}
                      {a.kind ? ` (${a.kind})` : ''}
                      {a.discountPence > 0 ? ` — saves ${penceToGBP(a.discountPence)}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}

              {hasOffersAutoAdd ? (
                <ul className={styles.muted} style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {offers.autoAdd.map((x, idx) => (
                    <li key={`${x.reasonOfferId}:${idx}`}>
                      Free at checkout: {x.name} × {x.qty}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className={styles.muted}>Shipping & taxes calculated at checkout.</p>
          )}

          <Link className={styles.checkout} href="/checkout">
            Checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}
