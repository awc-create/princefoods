'use client';

import type { CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import styles from '../OrderSummary.module.scss';

interface BogofRule {
  buyQty: number;
  getQty: number;
}

export default function TotalsBlock({
  items,
  bogofById,
  liveSubtotal,
  fullPricePence,
  shippingCost,
  usingOffers,
  effectiveDiscountShown,
  customerTotalShown,
  grand
}: {
  items: CartLine[];
  bogofById: Record<string, BogofRule>;
  liveSubtotal: number;
  fullPricePence?: number;
  shippingCost: number;
  usingOffers: boolean;
  effectiveDiscountShown: number;
  customerTotalShown: number;
  grand: number;
}) {
  const savedPence =
    fullPricePence && fullPricePence > liveSubtotal ? fullPricePence - liveSubtotal : 0;

  return (
    <>
      {/* Per-product line totals */}
      {items.map((it) => {
        const productId = it.productId ?? it.id;
        const rule = bogofById[productId];
        const paidQty = Math.max(1, Math.trunc(it.quantity));
        const unitPence = Math.max(0, Math.trunc(it.unitPrice));
        const freeQty = rule ? Math.floor(paidQty / rule.buyQty) * rule.getQty : 0;
        const totalQty = paidQty + freeQty;
        const paidPence = unitPence * paidQty;
        const fullPence = unitPence * totalQty;
        const hasFree = freeQty > 0;

        return (
          <div key={it.id} className={styles.row}>
            <span className={styles.lineLabel}>
              {it.name.length > 28 ? it.name.slice(0, 27) + '…' : it.name}{' '}
              <span className={styles.lineQty}>
                ×{totalQty}
                {hasFree ? ` (${paidQty}+${freeQty} free)` : ''}
              </span>
            </span>
            <div className={styles.summaryPrice}>
              {hasFree && <span className={styles.summaryWas}>{penceToGBP(fullPence)}</span>}
              <span className={hasFree ? styles.summaryNow : undefined}>
                {penceToGBP(paidPence)}
              </span>
            </div>
          </div>
        );
      })}

      {/* Subtotal */}
      <div className={`${styles.row} ${styles.subtotalRow}`}>
        <span>Subtotal</span>
        <div className={styles.summaryPrice}>
          {savedPence > 0 && (
            <span className={styles.summaryWas}>{penceToGBP(fullPricePence!)}</span>
          )}
          <span className={savedPence > 0 ? styles.summaryNow : undefined}>
            {penceToGBP(liveSubtotal)}
          </span>
        </div>
      </div>

      {savedPence > 0 && (
        <div className={styles.savingsBanner}>🎉 You save {penceToGBP(savedPence)} with offers</div>
      )}

      {/* Shipping */}
      <div className={styles.row}>
        <span>Shipping</span>
        <span>{shippingCost > 0 ? penceToGBP(shippingCost) : 'Calculated at checkout'}</span>
      </div>

      {effectiveDiscountShown > 0 && (
        <div className={styles.row} style={{ color: '#16a34a' }}>
          <span>{usingOffers ? 'Offer discount' : 'Promo discount'}</span>
          <span>-{penceToGBP(effectiveDiscountShown)}</span>
        </div>
      )}

      {customerTotalShown > 0 && (
        <div className={styles.row} style={{ color: '#16a34a' }}>
          <span>Customer discount</span>
          <span>-{penceToGBP(customerTotalShown)}</span>
        </div>
      )}

      <div className={styles.total}>
        <span>Total</span>
        <strong>{penceToGBP(grand)}</strong>
      </div>
    </>
  );
}
