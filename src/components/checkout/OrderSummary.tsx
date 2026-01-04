// src/components/checkout/OrderSummary.tsx
'use client';

import styles from '@/app/checkout/checkout.module.scss';
import type { CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ShippingKind = 'DRY' | 'FROZEN' | 'MIXED';

interface EvalItem {
  productId?: string | null;
  sku?: string | null;
  unitPrice: number; // pence
  quantity: number;
}

interface EvaluateOk {
  ok: true;
  currency: string;
  promotionId: string;
  code: string;
  name: string;
  discountPence: number;
  shippingDiscountPence: number;
}

interface EvaluateErr {
  ok: false;
  error: string;
}
type EvaluateResp = EvaluateOk | EvaluateErr;

function normCode(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, '');
}

function friendlyPromoError(code: string) {
  switch (code) {
    case 'CODE_REQUIRED':
      return 'Enter a promo code.';
    case 'INVALID_CODE':
      return 'That code is not recognised.';
    case 'PROMO_NOT_ACTIVE':
      return 'This promo is not active.';
    case 'PROMO_NOT_STARTED':
      return 'This promo is not valid yet.';
    case 'PROMO_EXPIRED':
      return 'This promo has expired.';
    case 'PROMO_LOCKED_TO_USER':
    case 'PROMO_LOCKED_TO_EMAIL':
      return 'This code is not eligible for this customer.';
    case 'PROMO_MAX_USES_REACHED':
      return 'This code has reached its usage limit.';
    case 'PROMO_MAX_USES_PER_USER_REACHED':
    case 'PROMO_MAX_USES_PER_EMAIL_REACHED':
      return 'This code has already been used.';
    case 'NO_ITEMS':
      return 'Your cart is empty.';
    default:
      return code || 'Promo could not be applied.';
  }
}

export default function OrderSummary({
  mounted,
  items,
  liveSubtotal,
  shippingCost,
  grand,
  onDecQty,
  onIncQty,
  onSetQty,
  onRemove,
  promo,
  setPromo,

  userId,
  email,
  currency = 'GBP',
  shippingKind = 'DRY',
  onPromoApplied,

  // ✅ NEW: changes when shipping/totals/address changes → we auto re-check if promo is applied
  recheckKey
}: {
  mounted: boolean;
  items: CartLine[];
  liveSubtotal: number;
  shippingCost: number;
  grand: number;
  onDecQty: (id: string) => void;
  onIncQty: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  promo: string;
  setPromo: (v: string) => void;

  userId?: string | null;
  email?: string | null;
  currency?: string;
  shippingKind?: ShippingKind;

  onPromoApplied?: (v: {
    promotionId: string | null;
    promotionCode: string | null;
    promoName?: string | null;
    discountPence: number;
    shippingDiscountPence: number;
  }) => void;

  recheckKey?: string;
}) {
  const [promoState, setPromoState] = useState<
    | { status: 'idle' }
    | { status: 'checking' }
    | {
        status: 'applied';
        promotionId: string;
        code: string;
        name: string;
        discountPence: number;
        shippingDiscountPence: number;
      }
    | { status: 'error'; message: string }
  >({ status: 'idle' });

  const itemDiscount = useMemo(() => {
    if (promoState.status !== 'applied') return 0;
    return Math.max(0, Math.trunc(promoState.discountPence));
  }, [promoState]);

  const shipDiscount = useMemo(() => {
    if (promoState.status !== 'applied') return 0;
    return Math.max(0, Math.trunc(promoState.shippingDiscountPence));
  }, [promoState]);

  const promoDiscountTotal = useMemo(
    () => Math.max(0, itemDiscount + shipDiscount),
    [itemDiscount, shipDiscount]
  );

  const clearAppliedSnapshot = useCallback(() => {
    onPromoApplied?.({
      promotionId: null,
      promotionCode: null,
      promoName: null,
      discountPence: 0,
      shippingDiscountPence: 0
    });
  }, [onPromoApplied]);

  const applyPromoNow = useCallback(async () => {
    if (!mounted) return;

    const code = normCode(promo);
    if (!code) {
      setPromoState({ status: 'error', message: 'Enter a promo code.' });
      clearAppliedSnapshot();
      return;
    }

    if (!items.length) {
      setPromoState({ status: 'error', message: 'Your cart is empty.' });
      clearAppliedSnapshot();
      return;
    }

    const evalItems: EvalItem[] = items.map((it) => ({
      productId: it.productId ?? null,
      sku: (it as unknown as { sku?: string | null }).sku ?? null,
      unitPrice: Math.max(0, Math.trunc(it.unitPrice)),
      quantity: Math.max(1, Math.trunc(it.quantity))
    }));

    setPromoState({ status: 'checking' });

    try {
      const res = await fetch('/api/promotions/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code,
          items: evalItems,
          userId: userId ?? null,
          email: email ?? null,

          // ✅ server computes subtotal from items; we only pass current shipping
          shippingPence: Math.max(0, Math.trunc(shippingCost)),
          currency,
          shippingKind
        })
      });

      const data = (await res.json()) as EvaluateResp;

      if (!data || data.ok !== true) {
        const err = (data as EvaluateErr | null)?.error ?? 'Promo could not be applied.';
        const msg = friendlyPromoError(err);
        setPromoState({ status: 'error', message: msg });
        clearAppliedSnapshot();
        return;
      }

      const discountPence = Math.max(0, Math.trunc(data.discountPence));
      const shippingDiscountPence = Math.max(0, Math.trunc(data.shippingDiscountPence));

      setPromoState({
        status: 'applied',
        promotionId: data.promotionId,
        code: data.code,
        name: data.name,
        discountPence,
        shippingDiscountPence
      });

      onPromoApplied?.({
        promotionId: data.promotionId,
        promotionCode: data.code,
        promoName: data.name,
        discountPence,
        shippingDiscountPence
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Promo check failed.';
      setPromoState({ status: 'error', message: msg });
      clearAppliedSnapshot();
    }
  }, [
    mounted,
    promo,
    items,
    userId,
    email,
    shippingCost,
    currency,
    shippingKind,
    onPromoApplied,
    clearAppliedSnapshot
  ]);

  // ✅ Auto re-check when shipping/totals change (ONLY if already applied)
  useEffect(() => {
    if (!mounted) return;
    if (!recheckKey) return;
    if (promoState.status !== 'applied') return;
    if (!promo.trim()) return;
    if (!items.length) return;

    void applyPromoNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recheckKey]);

  function clearPromo() {
    setPromo('');
    setPromoState({ status: 'idle' });
    clearAppliedSnapshot();
  }

  return (
    <aside className={styles.summary} aria-label="Order summary">
      <h3 className={styles.h3}>Summary</h3>

      <ul className={styles.items}>
        {!mounted && <li className={styles.muted}>Loading cart…</li>}
        {mounted && items.length === 0 && <li className={styles.muted}>Your cart is empty.</li>}

        {mounted &&
          items.map((it) => (
            <li key={it.id} className={styles.itemRow}>
              <div className={styles.itemLeft}>
                <div className={styles.thumbWrap} aria-hidden>
                  <img
                    src={it.imageUrl ?? it.image ?? '/assets/prince-foods-logo.png'}
                    alt={it.name}
                    className={styles.thumb}
                    loading="lazy"
                    decoding="async"
                  />
                </div>

                <div className={styles.itemMeta}>
                  <span className={styles.itemName} title={it.name}>
                    {it.name}
                  </span>

                  <div className={styles.qtyControls} aria-label="Quantity controls">
                    <button
                      type="button"
                      onClick={() => (it.quantity > 1 ? onDecQty(it.id) : onRemove(it.id))}
                      className={styles.qtyBtn}
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>

                    <input
                      className={styles.qtyInput}
                      inputMode="numeric"
                      value={it.quantity}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value || '1', 10));
                        onSetQty(it.id, v);
                      }}
                      aria-label="Quantity"
                    />

                    <button
                      type="button"
                      onClick={() => onIncQty(it.id)}
                      className={styles.qtyBtn}
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className={styles.itemPrice}>{penceToGBP(it.unitPrice * it.quantity)}</div>
            </li>
          ))}
      </ul>

      <div className={styles.promoRow}>
        <input
          className={styles.promoInput}
          placeholder="Promo code"
          value={promo}
          onChange={(e) => setPromo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (promoState.status !== 'checking') void applyPromoNow();
            }
          }}
        />

        {promoState.status === 'applied' ? (
          <button
            type="button"
            className={styles.promoBtn}
            onClick={clearPromo}
            title="Remove promo"
          >
            Remove
          </button>
        ) : (
          <button
            type="button"
            className={styles.promoBtn}
            onClick={applyPromoNow}
            disabled={!mounted || promoState.status === 'checking' || items.length === 0}
            title="Apply promo"
          >
            {promoState.status === 'checking' ? 'Checking…' : 'Apply'}
          </button>
        )}
      </div>

      {promoState.status === 'applied' && (
        <p className={styles.promoHint}>
          ✅ Applied: <strong>{promoState.code}</strong>
          {promoState.name ? <> — {promoState.name}</> : null}
          {promoDiscountTotal > 0 ? <> ({penceToGBP(promoDiscountTotal)} off)</> : null}
        </p>
      )}

      {promoState.status === 'error' && (
        <p className={styles.promoHint} style={{ color: '#ef4444' }}>
          {promoState.message}
        </p>
      )}

      <div className={styles.row}>
        <span>Subtotal</span>
        <span>{penceToGBP(liveSubtotal)}</span>
      </div>

      <div className={styles.row}>
        <span>Shipping</span>
        <span>{penceToGBP(shippingCost)}</span>
      </div>

      {promoState.status === 'applied' && (itemDiscount > 0 || shipDiscount > 0) && (
        <>
          {itemDiscount > 0 && (
            <div className={styles.row}>
              <span>Promo discount</span>
              <span>-{penceToGBP(itemDiscount)}</span>
            </div>
          )}

          {shipDiscount > 0 && (
            <div className={styles.row}>
              <span>Shipping discount</span>
              <span>-{penceToGBP(shipDiscount)}</span>
            </div>
          )}

          <div className={styles.row}>
            <span>Total discount ({promoState.code})</span>
            <span>-{penceToGBP(promoDiscountTotal)}</span>
          </div>
        </>
      )}

      <div className={styles.total}>
        <span>Total</span>
        <strong>{penceToGBP(grand)}</strong>
      </div>
    </aside>
  );
}
