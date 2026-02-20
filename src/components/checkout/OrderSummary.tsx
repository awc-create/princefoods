'use client';

import type { CartLine } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './OrderSummary.module.scss';

type ShippingKind = 'DRY' | 'FROZEN' | 'MIXED';

interface EvalItem {
  productId?: string | null;
  sku?: string | null;
  unitPrice: number;
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

interface LineDiscount {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  amountPence: number;
  reason?: 'FREE' | 'DISCOUNT';
}

interface LineParticipant {
  productId?: string | null;
  sku?: string | null;
  name: string;
  qty: number;
  role?: 'BUY' | 'GET' | 'ELIGIBLE' | 'FREE';
}

interface OfferCard {
  offerId: string;
  name: string;
  kind: string;
  discountPence: number;
  meta?: {
    lineDiscounts?: LineDiscount[];
    lineParticipants?: LineParticipant[];
    groups?: number;
    freeCount?: number;
    samePool?: boolean;
  } | null;
}

interface OffersSnapshot {
  discountPence: number;
  applied: OfferCard[];
  eligible?: OfferCard[];
  autoAdd: {
    reasonOfferId: string;
    productId?: string | null;
    sku?: string | null;
    name: string;
    qty: number;
  }[];
}

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

const normNameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const normSkuKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');

function itemKeyOf(x: { productId?: string | null; sku?: string | null; name: string }) {
  if (x.productId) return `pid:${x.productId}`;
  if (x.sku) return `sku:${normSkuKey(x.sku)}`;
  return `name:${normNameKey(x.name)}`;
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
  promoDiscountTotal
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

    if (usingOffers) {
      const merged = [...offers.applied, ...eligible];

      const seen = new Set<string>();
      return merged.filter((o) => {
        const id = String(o.offerId ?? '');
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    }

    return eligible.length ? eligible : offers.applied;
  }, [usingOffers, offers.applied, offers.eligible]);

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

  const offersTotalComputed = useMemo(() => {
    const backend = Math.max(0, Math.trunc(offers.discountPence ?? 0));
    if (backend > 0) return backend;

    return offers.applied.reduce(
      (sum, a) => sum + Math.max(0, Math.trunc(a.discountPence ?? 0)),
      0
    );
  }, [offers.discountPence, offers.applied]);

  const offerTotalShown = Math.max(0, Math.trunc(offerDiscountTotal ?? offersTotalComputed ?? 0));
  const effectiveDiscountShown = usingOffers ? offerTotalShown : promoTotalShown;

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

  function clearPromo() {
    setPromo('');
    setPromoState({ status: 'idle' });
    clearAppliedSnapshot();
  }

  // -----------------------------
  // Offer display helpers
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

  return (
    <aside className={styles.summary} aria-label="Order summary">
      <h3 className={styles.h3}>Summary</h3>

      <ul className={styles.items}>
        {!mounted && <li className={styles.muted}>Loading cart…</li>}
        {mounted && items.length === 0 && <li className={styles.muted}>Your cart is empty.</li>}

        {mounted &&
          items.map((it) => {
            const sku = (it as unknown as { sku?: string | null }).sku ?? null;

            const itemKey = itemKeyOf({
              productId: it.productId ?? null,
              sku,
              name: it.name
            });

            const lineOfferDiscount = offerDiscountByItemKey.get(itemKey) ?? 0;

            const offerNames = offerNamesByItemKey.get(itemKey) ?? [];
            const freeQty = usingOffers ? (freeQtyByItemKey.get(itemKey) ?? 0) : 0;

            // Display qty includes free units (BOGOF-style)
            const displayQty = Math.max(1, Math.trunc(it.quantity)) + Math.max(0, freeQty);

            const paidQty = Math.max(1, Math.trunc(it.quantity));
            const fullQty = paidQty + Math.max(0, freeQty);

            const unit = Math.max(0, Math.trunc(it.unitPrice));
            const paidTotalPence = unit * paidQty;
            const fullTotalPence = unit * fullQty;

            // ✅ NEW: show Was/Now for percentage/amount discounts too
            const safeLineDiscount = Math.max(0, Math.trunc(lineOfferDiscount ?? 0));
            const discountedNowPence = Math.max(0, paidTotalPence - safeLineDiscount);

            const showWasForBogof = usingOffers && freeQty > 0 && fullTotalPence > paidTotalPence;

            const showWasForDiscount =
              usingOffers &&
              freeQty === 0 &&
              safeLineDiscount > 0 &&
              discountedNowPence < paidTotalPence;

            // When free qty exists, keep input readOnly (avoids mismatch when typing)
            const lockQtyInput = freeQty > 0 && usingOffers;

            return (
              <li key={it.id} className={styles.itemRow}>
                <div className={styles.itemLeft}>
                  <div className={styles.thumbWrap} aria-hidden>
                    <img
                      src={
                        it.imageUrl ??
                        (it as unknown as { image?: string | null }).image ??
                        '/assets/prince-foods-logo.png'
                      }
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
                        value={displayQty}
                        readOnly={lockQtyInput}
                        onChange={(e) => {
                          if (lockQtyInput) return;
                          const v = Math.max(1, parseInt(e.target.value || '1', 10));
                          onSetQty(it.id, v);
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
                        onClick={() => onIncQty(it.id)}
                        className={styles.qtyBtn}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    {usingOffers && freeQty > 0 && (
                      <div className={styles.offerLineHint}>
                        Includes <strong>{freeQty}</strong> free item{freeQty === 1 ? '' : 's'}
                      </div>
                    )}

                    {lineOfferDiscount > 0 && (
                      <div className={styles.offerLineHint}>
                        Offer applied: <strong>-{penceToGBP(lineOfferDiscount)}</strong>
                      </div>
                    )}

                    {offerNames.length > 0 && (
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

                {/* ✅ PRICE DISPLAY:
                    - BOGOF: Was = full price incl free units, Now = paid price
                    - %/amount off: Was = paid price, Now = paid price minus discount
                    - otherwise: normal paid price
                */}
                <div className={styles.itemPrice}>
                  {showWasForBogof ? (
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                      <span style={{ textDecoration: 'line-through', opacity: 0.65, fontSize: 13 }}>
                        Was {penceToGBP(fullTotalPence)}
                      </span>
                      <span>Now {penceToGBP(paidTotalPence)}</span>
                    </div>
                  ) : showWasForDiscount ? (
                    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
                      <span style={{ textDecoration: 'line-through', opacity: 0.65, fontSize: 13 }}>
                        Was {penceToGBP(paidTotalPence)}
                      </span>
                      <span>Now {penceToGBP(discountedNowPence)}</span>
                    </div>
                  ) : (
                    penceToGBP(paidTotalPence)
                  )}
                </div>
              </li>
            );
          })}
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

      {promoState.status === 'applied' && !usingOffers && (
        <p className={styles.promoHint}>
          ✅ Applied: <strong>{promoState.code}</strong>
          {promoState.name ? <> — {promoState.name}</> : null}
          {promoTotalShown > 0 ? <> ({penceToGBP(promoTotalShown)} off)</> : null}
        </p>
      )}

      {promoState.status === 'error' && <p className={styles.err}>{promoState.message}</p>}

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

      <div className={styles.total}>
        <span>Total</span>
        <strong>{penceToGBP(grand)}</strong>
      </div>
    </aside>
  );
}
