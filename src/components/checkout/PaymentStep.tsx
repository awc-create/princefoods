// src/components/checkout/PaymentStep.tsx
'use client';

import styles from './PaymentStep.module.scss';
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
  onPayWithStripeTest,
  onPlaceTestOrder,
  grandTotalPence
}: {
  delivery: Delivery;
  setDelivery: (d: Delivery) => void;
  placing: boolean;
  formValid: boolean;
  mounted: boolean;
  err: string | null;
  onEditAddress: () => void;

  onPlaceOrder: () => Promise<void> | void;

  isAdmin: boolean;

  onPayWithStripe: () => Promise<void> | void;
  onPayWithStripeTest: () => Promise<void> | void;

  onPlaceTestOrder: () => Promise<void> | void;

  grandTotalPence: number;
}) {
  void delivery;
  void setDelivery;

  const disabled = placing || (mounted ? !formValid : true);

  const totalPence = Math.max(0, Math.trunc(grandTotalPence ?? 0));
  const isFreeOrder = totalPence <= 0;

  // ✅ isolate click handling (prevents any weird parent/overlay bubbling)
  const handleLiveClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    void onPayWithStripe();
  };

  const handleTestClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    void onPayWithStripeTest();
  };

  const handlePlaceOrder: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    void onPlaceOrder();
  };

  const handlePlaceTestOrder: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (placing || !formValid) return;
    void onPlaceTestOrder();
  };

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

      {isFreeOrder && (
        <div className={styles.infoBox} role="status" aria-live="polite">
          <div className={styles.infoTitle}>No payment required</div>
          <div className={styles.infoText}>
            Your discount covers the full order total. You can place the order now without payment.
          </div>
        </div>
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
            <div className={styles.summaryValue}>{isFreeOrder ? 'None' : 'Card'}</div>
            <div className={styles.summaryHint}>
              {isFreeOrder
                ? 'No payment is required for this order.'
                : 'You’ll be redirected to Stripe to complete payment.'}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className={styles.summaryTitle}>Security</div>
            <div className={styles.summaryValue}>Encrypted</div>
            <div className={styles.summaryHint}>Secure checkout</div>
          </div>
        </div>
      </div>

      <div className={styles.stepActions} style={{ position: 'relative', zIndex: 1 }}>
        {isFreeOrder ? (
          <button
            type="button"
            className={styles.primaryBtn}
            disabled={disabled}
            aria-disabled={disabled}
            onClick={handlePlaceOrder}
            title="Places your order without payment (total is £0)."
            data-testid="pay-free"
            style={{ pointerEvents: 'auto' }}
          >
            {placing ? 'Placing…' : 'Place order'}
          </button>
        ) : (
          <div
            style={{
              display: 'grid',
              gap: 12,
              position: 'relative',
              zIndex: 2
            }}
          >
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={disabled}
              aria-disabled={disabled}
              onClick={handleLiveClick}
              title="Redirects to Stripe Checkout (LIVE) to complete payment."
              data-testid="pay-live"
              style={{ pointerEvents: 'auto' }}
            >
              {placing ? 'Redirecting…' : 'Pay securely'}
            </button>

            {isAdmin && (
              <button
                type="button"
                className={styles.secondaryBtn}
                disabled={disabled}
                aria-disabled={disabled}
                onClick={handleTestClick}
                title="Admin-only: Redirects to Stripe Checkout (TEST)."
                data-testid="pay-test"
                style={{ pointerEvents: 'auto' }}
              >
                {placing ? 'Redirecting…' : 'Pay with Test Stripe (admin)'}
              </button>
            )}
          </div>
        )}

        <p className={styles.muted}>
          Delivery and promo discounts are re-checked on the server before the order is created.
        </p>

        {isAdmin && (
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handlePlaceTestOrder}
            disabled={placing || !formValid}
            aria-disabled={placing || !formValid}
            title="Admin-only: writes a paid test order directly (skips Stripe)."
            data-testid="place-test-order"
            style={{ pointerEvents: 'auto' }}
          >
            Place Test Order (admin only)
          </button>
        )}
      </div>
    </>
  );
}
