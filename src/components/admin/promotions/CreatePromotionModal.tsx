'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './promotions.module.scss';

import MultiPicker from './MultiPicker';
import type { CreateBody, PickerOption, PromoKindUI, TargetType } from './types';
import {
  clampInt,
  dedupeIds,
  kindToDiscountType,
  normCode,
  poundsToPence,
  toIntOrNull
} from './utils';

export default function CreatePromotionModal({
  open,
  onClose,
  categoryOptions,
  productOptions,
  optionsLoading,
  optionsError,
  onRequestOptions,
  onCreate,
  creating,
  createError
}: {
  open: boolean;
  onClose: () => void;

  categoryOptions: PickerOption[];
  productOptions: PickerOption[];
  optionsLoading: boolean;
  optionsError: string | null;
  onRequestOptions: () => void;

  onCreate: (body: CreateBody) => void;
  creating: boolean;
  createError: string | null;
}) {
  const dialogBodyRef = useRef<HTMLDivElement | null>(null);

  const [promoKind, setPromoKind] = useState<PromoKindUI>('AMOUNT_OFF');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('SITE_WIDE');
  const [discountValue, setDiscountValue] = useState('');
  const [applyShipping, setApplyShipping] = useState(false);
  const [shippingPct, setShippingPct] = useState('100');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [noEnd, setNoEnd] = useState(true);
  const [limitTotal, setLimitTotal] = useState(false);
  const [maxUsesTotal, setMaxUsesTotal] = useState('');
  const [limitPerCustomer, setLimitPerCustomer] = useState(false);

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const [localErr, setLocalErr] = useState<string | null>(null);

  const reset = () => {
    setPromoKind('AMOUNT_OFF');
    setCode('');
    setName('');
    setTargetType('SITE_WIDE');
    setDiscountValue('');
    setApplyShipping(false);
    setShippingPct('100');
    setStartsAt('');
    setEndsAt('');
    setNoEnd(true);
    setLimitTotal(false);
    setMaxUsesTotal('');
    setLimitPerCustomer(false);
    setSelectedCategoryIds([]);
    setSelectedProductIds([]);
    setLocalErr(null);
  };

  useEffect(() => {
    if (!open) return;
    reset();
    onRequestOptions();
    window.setTimeout(() => dialogBodyRef.current?.scrollTo({ top: 0 }), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (promoKind === 'FREE_SHIPPING') {
      setApplyShipping(true);
      setShippingPct('100');
      setDiscountValue('');
    }
  }, [promoKind]);

  useEffect(() => {
    if (targetType === 'SITE_WIDE') {
      setSelectedCategoryIds([]);
      setSelectedProductIds([]);
    }
    if (targetType === 'CATEGORIES') setSelectedProductIds([]);
    if (targetType === 'PRODUCTS') setSelectedCategoryIds([]);
  }, [targetType]);

  const showPicker = targetType === 'CATEGORIES' || targetType === 'PRODUCTS';

  function submit() {
    setLocalErr(null);

    const c = normCode(code);
    const n = name.trim();

    if (!c) return setLocalErr('Promo code is required.');
    if (!n) return setLocalErr('Promo name is required.');

    if (targetType === 'CATEGORIES' && selectedCategoryIds.length === 0)
      return setLocalErr('Select at least 1 category.');
    if (targetType === 'PRODUCTS' && selectedProductIds.length === 0)
      return setLocalErr('Select at least 1 product.');

    const discountType = kindToDiscountType(promoKind);

    let percentOff: number | null | undefined = undefined;
    let amountOffPence: number | null | undefined = undefined;

    if (promoKind === 'PERCENT_OFF') {
      const pct = toIntOrNull(discountValue);
      if (pct == null) return setLocalErr('Enter a valid percent.');
      percentOff = clampInt(pct, 0, 100);
    } else if (promoKind === 'AMOUNT_OFF') {
      const pence = poundsToPence(discountValue);
      if (pence == null) return setLocalErr('Enter a valid amount.');
      amountOffPence = Math.max(0, pence);
    } else {
      amountOffPence = 0;
    }

    const shipPctInt = toIntOrNull(shippingPct);
    const shipPctClamped = shipPctInt == null ? 0 : clampInt(shipPctInt, 0, 100);

    const body: CreateBody = {
      name: n,
      code: c,
      type: 'CODE',
      status: 'ACTIVE',
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: noEnd ? null : endsAt ? new Date(endsAt).toISOString() : null,

      maxUsesTotal: limitTotal ? toIntOrNull(maxUsesTotal) : null,
      maxUsesPerUser: limitPerCustomer ? 1 : null,

      targetType,
      discountType,
      ...(percentOff !== undefined ? { percentOff } : {}),
      ...(amountOffPence !== undefined ? { amountOffPence } : {}),

      applyShippingDiscount: applyShipping || promoKind === 'FREE_SHIPPING',
      shippingPercentOffDry: applyShipping || promoKind === 'FREE_SHIPPING' ? shipPctClamped : null,
      shippingPercentOffFrozen:
        applyShipping || promoKind === 'FREE_SHIPPING' ? shipPctClamped : null,

      categoryIds: targetType === 'CATEGORIES' ? dedupeIds(selectedCategoryIds) : [],
      productIds: targetType === 'PRODUCTS' ? dedupeIds(selectedProductIds) : []
    };

    onCreate(body);
  }

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>New promotion</div>
            <div className={styles.modalSub}>Choose a promo type and configure the code.</div>
          </div>

          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody} ref={dialogBodyRef}>
          <div className={styles.kindRow}>
            <button
              type="button"
              className={`${styles.kindCard} ${promoKind === 'AMOUNT_OFF' ? styles.kindActive : ''}`}
              onClick={() => setPromoKind('AMOUNT_OFF')}
            >
              <div className={styles.kindIcon}>£</div>
              <div>
                <div className={styles.kindTitle}>Amount off</div>
                <div className={styles.kindSub}>£ discount</div>
              </div>
            </button>

            <button
              type="button"
              className={`${styles.kindCard} ${promoKind === 'PERCENT_OFF' ? styles.kindActive : ''}`}
              onClick={() => setPromoKind('PERCENT_OFF')}
            >
              <div className={styles.kindIcon}>%</div>
              <div>
                <div className={styles.kindTitle}>Percent off</div>
                <div className={styles.kindSub}>% discount</div>
              </div>
            </button>

            <button
              type="button"
              className={`${styles.kindCard} ${promoKind === 'FREE_SHIPPING' ? styles.kindActive : ''}`}
              onClick={() => setPromoKind('FREE_SHIPPING')}
            >
              <div className={styles.kindIcon}>🚚</div>
              <div>
                <div className={styles.kindTitle}>Free shipping</div>
                <div className={styles.kindSub}>Shipping 100% off</div>
              </div>
            </button>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Promo code</label>
                <input
                  className={styles.input}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. SUMMERSALE20"
                />
                <div className={styles.hint}>Codes are stored uppercase with no spaces.</div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Promo name</label>
                <input
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer sale"
                />
              </div>
            </div>

            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Discount</label>
                <div className={styles.pillInput} aria-disabled={promoKind === 'FREE_SHIPPING'}>
                  <span className={styles.pillIcon}>{promoKind === 'PERCENT_OFF' ? '%' : '£'}</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    disabled={promoKind === 'FREE_SHIPPING'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={promoKind === 'PERCENT_OFF' ? 'e.g. 10' : 'e.g. 5'}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Apply to</label>
                <select
                  className={styles.select}
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as TargetType)}
                >
                  <option value="SITE_WIDE">All products</option>
                  <option value="CATEGORIES">Categories</option>
                  <option value="PRODUCTS">Products</option>
                </select>
                <div className={styles.hint}>
                  If you choose Categories/Products you can pick targets below.
                </div>
              </div>
            </div>

            {showPicker && (
              <div className={styles.cardInset}>
                {optionsError && <div className={styles.inlineError}>{optionsError}</div>}
                {optionsLoading && (
                  <div className={styles.mutedCell} style={{ padding: 10 }}>
                    Loading categories/products…
                  </div>
                )}

                {!optionsLoading && targetType === 'CATEGORIES' && (
                  <MultiPicker
                    title="Select categories"
                    placeholder="Search categories…"
                    options={categoryOptions}
                    selectedIds={selectedCategoryIds}
                    onChange={setSelectedCategoryIds}
                  />
                )}

                {!optionsLoading && targetType === 'PRODUCTS' && (
                  <MultiPicker
                    title="Select products"
                    placeholder="Search products (name/sku)…"
                    options={productOptions}
                    selectedIds={selectedProductIds}
                    onChange={setSelectedProductIds}
                  />
                )}
              </div>
            )}

            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Shipping discount</label>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={applyShipping}
                    onChange={(e) => setApplyShipping(e.target.checked)}
                    disabled={promoKind === 'FREE_SHIPPING'}
                  />
                  <span>
                    <strong>Add shipping discount</strong>
                    <div className={styles.hint}>
                      Works with Amount off and Percent off promos too.
                    </div>
                  </span>
                </label>
              </div>

              <div className={styles.field}>
                <label
                  className={styles.label}
                  style={{ opacity: applyShipping || promoKind === 'FREE_SHIPPING' ? 1 : 0.45 }}
                >
                  0–100%. Use 100% for free shipping.
                </label>
                <div
                  className={styles.pillInput}
                  style={{ opacity: applyShipping || promoKind === 'FREE_SHIPPING' ? 1 : 0.45 }}
                >
                  <span className={styles.pillIcon}>%</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    disabled={!(applyShipping || promoKind === 'FREE_SHIPPING')}
                    value={shippingPct}
                    onChange={(e) => setShippingPct(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Valid between</label>
                <input
                  className={styles.input}
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>&nbsp;</label>
                <input
                  className={styles.input}
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  disabled={noEnd}
                />
                <label className={styles.checkInline}>
                  <input
                    type="checkbox"
                    checked={noEnd}
                    onChange={(e) => setNoEnd(e.target.checked)}
                  />
                  <span>Don’t set an end date</span>
                </label>
              </div>
            </div>

            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Limit uses</label>

                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={limitTotal}
                    onChange={(e) => setLimitTotal(e.target.checked)}
                  />
                  <span>
                    <strong>Limit total number of uses</strong>
                    <div className={styles.hint}>Stops the promo after X redemptions.</div>
                  </span>
                </label>

                {limitTotal && (
                  <div className={styles.pillInput}>
                    <span className={styles.pillIcon}>#</span>
                    <input
                      className={styles.input}
                      inputMode="numeric"
                      value={maxUsesTotal}
                      onChange={(e) => setMaxUsesTotal(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>&nbsp;</label>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={limitPerCustomer}
                    onChange={(e) => setLimitPerCustomer(e.target.checked)}
                  />
                  <span>
                    <strong>Limit to one use per customer</strong>
                    <div className={styles.hint}>Sets max uses per user/email to 1.</div>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {(localErr ?? createError) && (
            <div className={styles.inlineError}>{localErr ?? createError}</div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button type="button" className={styles.primaryBtn} onClick={submit} disabled={creating}>
            {creating ? 'Creating…' : 'Create promo'}
          </button>
        </div>
      </div>
    </div>
  );
}
