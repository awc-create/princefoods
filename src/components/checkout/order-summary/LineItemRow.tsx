'use client';

import type { CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import styles from '../OrderSummary.module.scss';

export default function LineItemRow({
  it,
  displayQty,
  lockQtyInput,
  onDec,
  onInc,
  onSetQty,
  onRemove,
  usingOffers,
  freeQty,
  offerNames,
  productBadges = [],
  safeOfferDiscount,
  customerPct,
  custLineDiscount,
  showWasNow,
  wasPence,
  nowPence,
  savePence
}: {
  it: CartLine;
  displayQty: number;
  lockQtyInput: boolean;
  onDec: () => void;
  onInc: () => void;
  onSetQty: (qty: number) => void;
  onRemove: () => void;
  usingOffers: boolean;
  freeQty: number;
  offerNames: string[];
  productBadges?: string[];
  safeOfferDiscount: number;
  customerPct: number;
  custLineDiscount: number;
  showWasNow: boolean;
  wasPence: number;
  nowPence: number;
  savePence: number;
}) {
  const img =
    it.imageUrl ??
    (it as unknown as { image?: string | null }).image ??
    '/assets/prince-foods-logo.png';

  const paidQty = Math.max(1, Math.trunc(it.quantity));

  return (
    <li className={styles.itemRow}>
      <div className={styles.itemLeft}>
        <div className={styles.thumbWrap} aria-hidden>
          <img src={img} alt={it.name} className={styles.thumb} loading="lazy" decoding="async" />
          {customerPct > 0 && <div className={styles.discountBadge}>{customerPct}% OFF</div>}
        </div>

        <div className={styles.itemMeta}>
          <span className={styles.itemName} title={it.name}>
            {it.name}
          </span>

          <div className={styles.qtyControls} aria-label="Quantity controls">
            <button
              type="button"
              onClick={() => (it.quantity > 1 ? onDec() : onRemove())}
              className={styles.qtyBtn}
              aria-label="Decrease quantity"
            >
              −
            </button>

            <input
              className={styles.qtyInput}
              inputMode="numeric"
              value={displayQty}
              readOnly={lockQtyInput}
              onChange={(e) => {
                if (lockQtyInput) return;
                const v = Math.max(1, parseInt(e.target.value || '1', 10));
                onSetQty(v);
              }}
              aria-label="Quantity"
              title={
                lockQtyInput
                  ? `Includes ${freeQty} free item${freeQty === 1 ? '' : 's'}`
                  : undefined
              }
            />

            <button
              type="button"
              onClick={onInc}
              className={styles.qtyBtn}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Red offer badges — always visible */}
          {productBadges.length > 0 && (
            <div className={styles.badgeRow}>
              {productBadges.map((b) => (
                <span key={b} className={styles.offerBadgePill}>
                  {b}
                </span>
              ))}
            </div>
          )}

          {/* Free item count */}
          {freeQty > 0 && (
            <div className={styles.freeTag}>
              🎁 {freeQty} free — you pay for {paidQty}
            </div>
          )}

          {usingOffers && safeOfferDiscount > 0 && freeQty === 0 && (
            <div className={styles.offerLineHint}>
              Offer saving: <strong>-{penceToGBP(safeOfferDiscount)}</strong>
            </div>
          )}

          {customerPct > 0 && custLineDiscount > 0 && (
            <div className={styles.offerLineHint}>
              Customer {customerPct}% off (−{penceToGBP(custLineDiscount)})
            </div>
          )}

          {offerNames.length > 0 && productBadges.length === 0 && (
            <div className={styles.offerLineMeta}>
              {offerNames.map((n) => (
                <div key={n} className={styles.offerLineMetaRow}>
                  <span className={styles.offerLineMetaText}>{n}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.itemPrice}>
        {showWasNow ? (
          <div className={styles.priceBlock}>
            <span className={styles.was}>{penceToGBP(wasPence)}</span>
            <span className={styles.now}>{penceToGBP(nowPence)}</span>
            {savePence > 0 && <span className={styles.save}>Save {penceToGBP(savePence)}</span>}
          </div>
        ) : (
          penceToGBP(nowPence)
        )}
      </div>
    </li>
  );
}
