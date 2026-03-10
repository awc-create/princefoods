'use client';

import { penceToGBP } from '@/lib/money';
import styles from '../OrderSummary.module.scss';

export default function TotalsBlock({
  liveSubtotal,
  shippingCost,
  usingOffers,
  effectiveDiscountShown,
  customerTotalShown,
  grand
}: {
  liveSubtotal: number;
  shippingCost: number;
  usingOffers: boolean;
  effectiveDiscountShown: number;
  customerTotalShown: number;
  grand: number;
}) {
  return (
    <>
      <div className={styles.row}>
        <span>Subtotal</span>
        <span>{penceToGBP(liveSubtotal)}</span>
      </div>

      <div className={styles.row}>
        <span>Shipping</span>
        <span>{penceToGBP(shippingCost)}</span>
      </div>

      {effectiveDiscountShown > 0 && (
        <div className={styles.row}>
          <span>{usingOffers ? 'Discount (Offer)' : 'Discount (Promo)'}</span>
          <span>-{penceToGBP(effectiveDiscountShown)}</span>
        </div>
      )}

      {customerTotalShown > 0 && (
        <div className={styles.row}>
          <span>Discount (Customer)</span>
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
