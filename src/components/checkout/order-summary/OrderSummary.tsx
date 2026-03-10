'use client';

import type { CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from '../OrderSummary.module.scss';

import LineItemRow from './LineItemRow';
import PromoBox from './PromoBox';
import TotalsBlock from './TotalsBlock';

import type { EvalItem, EvaluateErr, EvaluateResp, OffersSnapshot, ShippingKind } from './types';
import { clampPct, itemKeyOf } from './utils';

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
  recheckKey,
  offersSnap,
  useOffers,
  offerDiscountTotal,
  promoDiscountTotal,
  customerDiscountPence = 0,
  customerShippingDiscountPence = 0
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

  offersSnap?: OffersSnapshot;
  useOffers?: boolean;
  offerDiscountTotal?: number;
  promoDiscountTotal?: number;

  customerDiscountPence?: number;
  customerShippingDiscountPence?: number;
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

  const offers = useMemo<OffersSnapshot>(
    () =>
      offersSnap ?? {
        discountPence: 0,
        applied: [],
        eligible: [],
        autoAdd: []
      },
    [offersSnap]
  );

  const usingOffers = Boolean(useOffers);

  const offersToShow = useMemo(() => {
    const eligible = offers.eligible ?? [];
    if (!usingOffers) return eligible.length ? eligible : offers.applied;

    const merged = [...offers.applied, ...eligible];
    const seen = new Set<string>();
    return merged.filter((o) => {
      const id = String(o.offerId ?? '');
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [usingOffers, offers.applied, offers.eligible]);

  // -----------------------------
  // Promo calc (local display)
  // -----------------------------
  const itemDiscount = useMemo(() => {
    if (promoState.status !== 'applied') return 0;
    return Math.max(0, Math.trunc(promoState.discountPence));
  }, [promoState]);

  const shipDiscount = useMemo(() => {
    if (promoState.status !== 'applied') return 0;
    return Math.max(0, Math.trunc(promoState.shippingDiscountPence));
  }, [promoState]);

  const localPromoDiscountTotal = useMemo(
    () => Math.max(0, itemDiscount + shipDiscount),
    [itemDiscount, shipDiscount]
  );

  const promoTotalShown = Math.max(
    0,
    Math.trunc(promoDiscountTotal ?? localPromoDiscountTotal ?? 0)
  );

  // -----------------------------
  // Offers total
  // -----------------------------
  const offersTotalComputed = useMemo(() => {
    const backend = Math.max(0, Math.trunc(offers.discountPence ?? 0));
    if (backend > 0) return backend;
    return offers.applied.reduce(
      (sum, a) => sum + Math.max(0, Math.trunc(a.discountPence ?? 0)),
      0
    );
  }, [offers.discountPence, offers.applied]);

  const offerTotalShown = Math.max(0, Math.trunc(offerDiscountTotal ?? offersTotalComputed ?? 0));

  // ✅ the row that "wins"
  const effectiveDiscountShown = usingOffers ? offerTotalShown : promoTotalShown;

  // -----------------------------
  // Customer totals
  // -----------------------------
  const customerItemsOffShown = Math.max(0, Math.trunc(customerDiscountPence ?? 0));
  const customerShipOffShown = Math.max(0, Math.trunc(customerShippingDiscountPence ?? 0));
  const customerTotalShown = Math.max(0, customerItemsOffShown + customerShipOffShown);

  // -----------------------------
  // Offer helpers for per-line info
  // -----------------------------
  const offerDiscountByItemKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of offersToShow) {
      const ld = a.meta?.lineDiscounts ?? [];
      for (const d of ld) {
        const k = itemKeyOf({ productId: d.productId ?? null, sku: d.sku ?? null, name: d.name });
        m.set(k, (m.get(k) ?? 0) + Math.max(0, Math.trunc(d.amountPence ?? 0)));
      }
    }
    return m;
  }, [offersToShow]);

  const offerNamesByItemKey = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of offersToShow) {
      const parts = a.meta?.lineParticipants ?? [];
      for (const p of parts) {
        const k = itemKeyOf({ productId: p.productId ?? null, sku: p.sku ?? null, name: p.name });
        const arr = m.get(k) ?? [];
        arr.push(a.name);
        m.set(k, arr);
      }
    }

    for (const [k, arr] of m.entries()) {
      const uniq = Array.from(new Set(arr.map((x) => x.trim()).filter(Boolean)));
      m.set(k, uniq);
    }
    return m;
  }, [offersToShow]);

  const freeQtyByItemKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of offers.autoAdd ?? []) {
      const k = itemKeyOf({ productId: a.productId ?? null, sku: a.sku ?? null, name: a.name });
      m.set(k, (m.get(k) ?? 0) + Math.max(0, Math.trunc(a.qty ?? 0)));
    }
    return m;
  }, [offers.autoAdd]);

  // -----------------------------
  // ✅ Derive customer percent from the *actual base* (sum of lines after offers)
  // This is why your "lines" were invisible: you had no percent to render.
  // -----------------------------
  const customerPct = useMemo(() => {
    if (customerItemsOffShown <= 0) return 0;

    let base = 0;
    for (const it of items) {
      const sku = (it as unknown as { sku?: string | null }).sku ?? null;
      const key = itemKeyOf({ productId: it.productId ?? null, sku, name: it.name });
      const paidQty = Math.max(1, Math.trunc(it.quantity));
      const unit = Math.max(0, Math.trunc(it.unitPrice));
      const paidTotal = unit * paidQty;

      const offerLine = usingOffers ? Math.max(0, offerDiscountByItemKey.get(key) ?? 0) : 0;
      base += Math.max(0, paidTotal - offerLine);
    }

    if (base <= 0) return 0;
    const pct = Math.round((customerItemsOffShown / base) * 100);
    return clampPct(pct);
  }, [customerItemsOffShown, items, usingOffers, offerDiscountByItemKey]);

  // -----------------------------
  // Promo apply
  // -----------------------------
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

  useEffect(() => {
    if (!mounted) return;
    if (!recheckKey) return;
    if (promoState.status !== 'applied') return;
    if (!promo.trim()) return;
    if (!items.length) return;
    void applyPromoNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recheckKey]);

  const clearPromo = useCallback(() => {
    setPromo('');
    setPromoState({ status: 'idle' });
    clearAppliedSnapshot();
  }, [setPromo, clearAppliedSnapshot]);

  return (
    <aside className={styles.summary} aria-label="Order summary">
      <h3 className={styles.h3}>Summary</h3>

      <ul className={styles.items}>
        {!mounted && <li className={styles.muted}>Loading cart…</li>}
        {mounted && items.length === 0 && <li className={styles.muted}>Your cart is empty.</li>}

        {mounted &&
          items.map((it) => {
            const sku = (it as unknown as { sku?: string | null }).sku ?? null;
            const key = itemKeyOf({ productId: it.productId ?? null, sku, name: it.name });

            const offerNames = offerNamesByItemKey.get(key) ?? [];
            const freeQty = usingOffers ? (freeQtyByItemKey.get(key) ?? 0) : 0;

            const displayQty = Math.max(1, Math.trunc(it.quantity)) + Math.max(0, freeQty);
            const paidQty = Math.max(1, Math.trunc(it.quantity));
            const fullQty = paidQty + Math.max(0, freeQty);

            const unit = Math.max(0, Math.trunc(it.unitPrice));
            const paidTotalPence = unit * paidQty;
            const fullTotalPence = unit * fullQty;

            const safeOfferDiscount = usingOffers
              ? Math.max(0, offerDiscountByItemKey.get(key) ?? 0)
              : 0;

            const afterOfferPence = Math.max(0, paidTotalPence - safeOfferDiscount);

            const custLineDiscount =
              customerPct > 0 ? Math.round((afterOfferPence * customerPct) / 100) : 0;

            const afterCustomerPence = Math.max(0, afterOfferPence - custLineDiscount);

            const showWasForBogof = usingOffers && freeQty > 0 && fullTotalPence > paidTotalPence;
            const showWasForOfferDiscount = usingOffers && freeQty === 0 && safeOfferDiscount > 0;
            const showWasForCustomer = customerPct > 0 && afterCustomerPence < afterOfferPence;

            const showWasNow = showWasForBogof || showWasForOfferDiscount || showWasForCustomer;

            const wasPence = showWasForBogof ? fullTotalPence : paidTotalPence;
            const nowPence = afterCustomerPence;
            const savePence = Math.max(0, wasPence - nowPence);

            const lockQtyInput = freeQty > 0 && usingOffers;

            return (
              <LineItemRow
                key={it.id}
                it={it}
                displayQty={displayQty}
                lockQtyInput={lockQtyInput}
                onDec={() => onDecQty(it.id)}
                onInc={() => onIncQty(it.id)}
                onSetQty={(q) => onSetQty(it.id, q)}
                onRemove={() => onRemove(it.id)}
                usingOffers={usingOffers}
                freeQty={freeQty}
                offerNames={offerNames}
                safeOfferDiscount={safeOfferDiscount}
                customerPct={customerPct}
                custLineDiscount={custLineDiscount}
                showWasNow={showWasNow}
                wasPence={wasPence}
                nowPence={nowPence}
                savePence={savePence}
              />
            );
          })}
      </ul>

      <PromoBox
        promo={promo}
        setPromo={setPromo}
        status={promoState.status}
        onApply={applyPromoNow}
        onClear={clearPromo}
        disabled={!mounted || items.length === 0}
      />

      {promoState.status === 'applied' && !usingOffers && (
        <p className={styles.promoHint}>
          ✅ Applied: <strong>{promoState.code}</strong>
          {promoState.name ? <> — {promoState.name}</> : null}
          {promoTotalShown > 0 ? <> ({penceToGBP(promoTotalShown)} off)</> : null}
        </p>
      )}

      {promoState.status === 'error' && <p className={styles.err}>{promoState.message}</p>}

      <TotalsBlock
        liveSubtotal={liveSubtotal}
        shippingCost={shippingCost}
        usingOffers={usingOffers}
        effectiveDiscountShown={effectiveDiscountShown}
        customerTotalShown={customerTotalShown}
        grand={grand}
      />
    </aside>
  );
}
