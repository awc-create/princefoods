// src/components/checkout/PaymentStep.tsx (FULL)
// ✅ looks filled (Standard delivery card), no express, no emptiness

'use client';

import styles from '@/app/checkout/checkout.module.scss';
import type { Delivery } from './types';

export default function PaymentStep({
  delivery,
  setDelivery,
  placing,
  formValid,
  mounted,
  err,
  onEditAddress,
  onPlaceOrder,
  isAdmin,
  onPayWithStripe,
  onPlaceTestOrder
}: {
  delivery: Delivery;
  setDelivery: (d: Delivery) => void;
  placing: boolean;
  formValid: boolean;
  mounted: boolean;
  err: string | null;
  onEditAddress: () => void;
  onPlaceOrder: () => void;
  isAdmin: boolean;
  onPayWithStripe: () => void;
  onPlaceTestOrder: () => void;
}) {
  // backend is STANDARD-only; keep compatibility
  void delivery;
  void setDelivery;

  const disabled = placing || (mounted ? !formValid : true);

  return (
    <>
      <div className={styles.paymentHeader}>
        <h3 className={styles.h3} style={{ marginTop: 0 }}>
          Payment
        </h3>
        <button type="button" className={styles.backBtn} onClick={onEditAddress}>
          Edit address
        </button>
      </div>

      {err && (
        <p className={styles.err} role="alert" aria-live="polite">
          {err}
        </p>
      )}

      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.summaryRow} style={{ alignItems: 'flex-start' }}>
          <div>
            <div className={styles.summaryTitle}>Delivery</div>
            <div className={styles.summaryValue}>Standard delivery</div>
            <div className={styles.summaryHint}>
              Calculated automatically from your address and basket (dry/frozen weight rules).
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className={styles.summaryTitle}>Service</div>
            <div className={styles.summaryValue}>STANDARD</div>
            <div className={styles.summaryHint}>No express option</div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.summaryRow}>
          <div>
            <div className={styles.summaryTitle}>Payment method</div>
            <div className={styles.summaryValue}>Card</div>
            <div className={styles.summaryHint}>You’ll be asked to confirm on the next step.</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className={styles.summaryTitle}>Security</div>
            <div className={styles.summaryValue}>Encrypted</div>
            <div className={styles.summaryHint}>Secure checkout</div>
          </div>
        </div>
      </div>

      <div className={styles.stepActions}>
        <button
          className={styles.place}
          disabled={disabled}
          onClick={onPlaceOrder}
          aria-disabled={disabled}
        >
          {placing ? 'Placing…' : 'Place order'}
        </button>

        <p className={styles.muted}>
          Delivery and promo discounts are re-checked on the server before the order is created.
        </p>

        {isAdmin && (
          <button
            type="button"
            className={styles.testBtn}
            onClick={onPayWithStripe}
            disabled={disabled}
            aria-disabled={disabled}
            title="Creates the order, then redirects to Stripe Checkout (test)."
          >
            Pay with Stripe (test)
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            className={styles.testBtn}
            onClick={onPlaceTestOrder}
            disabled={placing || !formValid}
            aria-disabled={placing || !formValid}
            title="Admin-only: writes a paid test order directly."
            style={{ marginTop: 8 }}
          >
            Place Test Order (admin only)
          </button>
        )}
      </div>
    </>
  );
}
