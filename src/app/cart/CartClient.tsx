'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { Minus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './cart.module.scss';

interface BogofRule {
  buyQty: number;
  getQty: number;
}

function friendlyKind(kind: string): string {
  const map: Record<string, string> = {
    BOGOF: 'Buy X Get 1 Free',
    BXGY: 'Buy X Get Y Free',
    PERCENT_OFF: 'Discount',
    AMOUNT_OFF: 'Discount',
    X_FOR_Y: 'Multibuy deal',
    X_FOR_FIXED_PRICE: 'Bundle price',
    SPEND_X_GET_Y: 'Spend & save',
    FREE_GIFT: 'Free gift',
    FLASH_SALE: 'Flash sale'
  };
  return map[kind] ?? kind;
}

export default function CartClient() {
  const {
    items,
    updateQty,
    remove,
    clear,
    offers,
    refreshOffers,
    offerNames,
    offerDiscountForLine
  } = useCart();

  const [confirmClear, setConfirmClear] = useState(false);
  const [badges, setBadges] = useState<Record<string, string[]>>({});
  const [bogof, setBogof] = useState<Record<string, BogofRule>>({});

  // Fetch offers on mount and whenever items change
  const itemsKey = items.map((i) => `${i.productId ?? i.id}:${i.quantity}`).join('|');
  useEffect(() => {
    void refreshOffers();
  }, [refreshOffers, itemsKey]);

  useEffect(() => {
    if (!items.length) return;
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
  }, [itemsKey]);

  const hasOffersApplied = (offers.applied?.length ?? 0) > 0;
  const hasOffersAutoAdd = (offers.autoAdd?.length ?? 0) > 0;
  const hasAnyOffer = hasOffersApplied || hasOffersAutoAdd;

  // Compute line data with direct BOGOF math (same as drawer)
  let subtotalPence = 0;
  let fullPricePence = 0;

  const lineData = items.map((it) => {
    const productId = it.productId ?? it.id;
    const rule = bogof[productId];
    const paidQty = Math.max(1, Math.trunc(it.quantity));
    const unitPence = Math.max(0, Math.trunc(it.unitPrice));

    let freeQty = 0;
    if (rule) {
      freeQty = Math.floor(paidQty / rule.buyQty) * rule.getQty;
    } else {
      // fallback: use engine discount
      const lineDiscount = Math.max(0, Math.trunc(offerDiscountForLine(it.id) ?? 0));
      const paidTotal = unitPence * paidQty;
      const discountedNow = Math.max(0, paidTotal - lineDiscount);
      subtotalPence += discountedNow > 0 && lineDiscount > 0 ? discountedNow : paidTotal;
      fullPricePence += paidTotal;
      return {
        it,
        paidQty,
        freeQty: 0,
        totalQty: paidQty,
        unitPence,
        paidPence: paidTotal,
        fullPence: paidTotal,
        rule: null,
        productId
      };
    }

    const totalQty = paidQty + freeQty;
    const paidPence = unitPence * paidQty;
    const fullPence = unitPence * totalQty;
    subtotalPence += paidPence;
    fullPricePence += fullPence;

    return { it, paidQty, freeQty, totalQty, unitPence, paidPence, fullPence, rule, productId };
  });

  const savedPence = fullPricePence - subtotalPence;
  const offerDiscount = Math.max(0, Math.trunc(offers.discountPence ?? 0));

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
            {lineData.map(
              ({ it, paidQty, freeQty, totalQty, unitPence, paidPence, fullPence, productId }) => {
                const productBadges = badges[productId] ?? [];
                const names = offerNames(it.id);

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
                      {it.sku && <div className={styles.sku}>{it.sku}</div>}
                      <div className={styles.price}>{penceToGBP(unitPence)} each</div>

                      {productBadges.length > 0 && (
                        <div className={styles.badgeRow}>
                          {productBadges.map((b) => (
                            <span key={b} className={styles.offerBadge}>
                              {b}
                            </span>
                          ))}
                        </div>
                      )}

                      {freeQty > 0 && (
                        <div className={styles.freeTag}>🎁 {freeQty} free included!</div>
                      )}

                      {names.length > 0 && freeQty === 0 && (
                        <div className={styles.offerText}>🎁 {names.join(' • ')}</div>
                      )}
                    </div>

                    <div className={styles.qtyRow}>
                      <button
                        onClick={() =>
                          paidQty <= 1 ? remove(it.id) : updateQty(it.id, paidQty - 1)
                        }
                        aria-label={paidQty <= 1 ? 'Remove' : 'Decrease'}
                      >
                        {paidQty <= 1 ? <Trash2 size={14} /> : <Minus />}
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
                      <Trash2 />
                    </button>
                  </li>
                );
              }
            )}
          </ul>

          {!confirmClear ? (
            <button className={styles.clear} onClick={() => setConfirmClear(true)}>
              Clear basket
            </button>
          ) : (
            <div className={styles.clearConfirm}>
              <span>Remove all items?</span>
              <button
                className={styles.clearYes}
                onClick={() => {
                  clear();
                  setConfirmClear(false);
                }}
              >
                Yes, clear
              </button>
              <button className={styles.clearNo} onClick={() => setConfirmClear(false)}>
                Cancel
              </button>
            </div>
          )}
        </section>

        <aside className={styles.summary}>
          <h3>Summary</h3>

          {/* Was/Now subtotal */}
          <div className={styles.row}>
            <span>Subtotal</span>
            <div className={styles.summaryPrice}>
              {savedPence > 0 && (
                <span className={styles.summaryWas}>{penceToGBP(fullPricePence)}</span>
              )}
              <span className={savedPence > 0 ? styles.summaryNow : undefined}>
                {penceToGBP(subtotalPence)}
              </span>
            </div>
          </div>

          {offerDiscount > 0 && (
            <div className={styles.row} style={{ color: '#16a34a' }}>
              <span>Offers</span>
              <span>-{penceToGBP(offerDiscount)}</span>
            </div>
          )}

          {savedPence > 0 && (
            <div className={styles.savingsBanner}>🎉 You save {penceToGBP(savedPence)}</div>
          )}

          <div
            className={styles.row}
            style={{
              fontWeight: 700,
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              marginTop: 4
            }}
          >
            <span>Total</span>
            <span>{penceToGBP(subtotalPence)}</span>
          </div>

          <p className={styles.muted} style={{ marginTop: 6 }}>
            + Shipping calculated at checkout
          </p>

          {hasAnyOffer && (
            <div className={styles.offersBlock}>
              {hasOffersApplied &&
                offers.applied.map((a) => (
                  <div key={`${a.offerId}:${a.kind}`} className={styles.offerChip}>
                    🎁 {a.name}
                    {a.discountPence > 0 && <span> — saves {penceToGBP(a.discountPence)}</span>}
                    {a.kind && <span className={styles.kindLabel}>{friendlyKind(a.kind)}</span>}
                  </div>
                ))}
              {hasOffersAutoAdd &&
                offers.autoAdd.map((x, i) => (
                  <div key={`${x.reasonOfferId}:${i}`} className={styles.offerChip}>
                    🎁 Free at checkout: {x.name} ×{x.qty}
                  </div>
                ))}
            </div>
          )}

          <Link className={styles.checkout} href="/checkout">
            Checkout
          </Link>
          <Link className={styles.continueShopping} href="/shop">
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}
