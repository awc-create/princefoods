'use client';

import { useEffect, useMemo, useState } from 'react';
import OfferRuleBuilder from './OfferRuleBuilder';
import OfferTargetPicker, { type PickerOption } from './OfferTargetPicker';
import styles from './offers.module.scss';

import type { OfferAdminForm, OfferTargetRule } from '@/types/offers';
import type { AdminOfferKind, OfferTargetType } from './types';
import { selectionToPool } from './types';

interface ApiErr {
  error: string;
}

function isOptionsOk(x: unknown): x is { options: PickerOption[] } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'options' in x &&
    Array.isArray((x as { options?: unknown }).options)
  );
}

function fmtErr(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function kindLabel(kind: AdminOfferKind) {
  if (kind === 'BOGOF') return 'BOGOF';
  if (kind === 'X_FOR_Y') return 'X for Y';
  return 'X for £';
}

function targetLabel(t: OfferTargetType) {
  if (t === 'SITE_WIDE') return 'All products';
  if (t === 'PRODUCTS') return 'Specific products';
  return 'Specific categories';
}

function buildPool(targetType: OfferTargetType, productIds: string[], categoryIds: string[]) {
  if (targetType === 'SITE_WIDE') return selectionToPool({ targetType: 'SITE_WIDE' });

  if (targetType === 'PRODUCTS') {
    return selectionToPool({ targetType: 'PRODUCTS', productIds });
  }

  return selectionToPool({ targetType: 'CATEGORIES', categoryIds });
}

export default function CreateOfferModal({
  open,
  onClose,
  onCreate
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (body: OfferAdminForm) => void;
}) {
  /* =====================
     Core fields
     ===================== */
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AdminOfferKind>('BOGOF');
  const [targetType, setTargetType] = useState<OfferTargetType>('SITE_WIDE');

  /* =====================
     Rule fields
     ===================== */
  const [buyQty, setBuyQty] = useState(2);
  const [getQty, setGetQty] = useState<number | null>(1);
  const [payQty, setPayQty] = useState<number | null>(1);
  const [pricePence, setPricePence] = useState<number | null>(100); // £1 default

  /* =====================
     Targeting
     ===================== */
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  /* =====================
     Picker options
     ===================== */
  const [productOptions, setProductOptions] = useState<PickerOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<PickerOption[]>([]);
  const [optErr, setOptErr] = useState<string | null>(null);
  const [optLoading, setOptLoading] = useState(false);

  /* =====================
     Validation
     ===================== */
  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;
    if (targetType === 'PRODUCTS') return productIds.length > 0;
    if (targetType === 'CATEGORIES') return categoryIds.length > 0;
    return true;
  }, [name, targetType, productIds.length, categoryIds.length]);

  const summary = useMemo(() => {
    const left = `${kindLabel(kind)} • ${targetLabel(targetType)}`;
    let right = '';

    if (targetType === 'PRODUCTS') right = `${productIds.length} selected`;
    if (targetType === 'CATEGORIES') right = `${categoryIds.length} selected`;

    return { left, right };
  }, [kind, targetType, productIds.length, categoryIds.length]);

  /* =====================
     Reset rule fields on kind change
     ===================== */
  useEffect(() => {
    if (!open) return;

    if (kind === 'BOGOF') {
      setPayQty(null);
      setPricePence(null);
      setGetQty((v) => v ?? 1);
      setBuyQty((v) => v || 2);
      return;
    }

    if (kind === 'X_FOR_Y') {
      setGetQty(null);
      setPricePence(null);
      setPayQty((v) => v ?? 1);
      setBuyQty((v) => v || 2);
      return;
    }

    if (kind === 'X_FOR_FIXED_PRICE') {
      setGetQty(null);
      setPayQty(null);
      setPricePence((v) => v ?? 100);
      setBuyQty((v) => v || 2);
    }
  }, [open, kind]);

  /* =====================
     Reset targets on target type change
     ===================== */
  useEffect(() => {
    if (!open) return;

    if (targetType === 'SITE_WIDE') {
      setProductIds([]);
      setCategoryIds([]);
    }
    if (targetType === 'PRODUCTS') {
      setCategoryIds([]);
    }
    if (targetType === 'CATEGORIES') {
      setProductIds([]);
    }
  }, [open, targetType]);

  /* =====================
     Load picker options
     ===================== */
  useEffect(() => {
    if (!open) return;
    if (targetType === 'SITE_WIDE') return;

    let cancelled = false;

    async function loadOptions() {
      setOptErr(null);
      setOptLoading(true);

      try {
        if (targetType === 'PRODUCTS' && productOptions.length === 0) {
          const res = await fetch('/api/admin/offers/options/products', { cache: 'no-store' });
          const json = (await res.json()) as { options: PickerOption[] } | ApiErr;

          if (!res.ok || !isOptionsOk(json)) {
            throw new Error(
              'error' in json && json.error ? json.error : 'Failed to load products.'
            );
          }

          if (!cancelled) setProductOptions(json.options);
        }

        if (targetType === 'CATEGORIES' && categoryOptions.length === 0) {
          const res = await fetch('/api/admin/offers/options/categories', { cache: 'no-store' });
          const json = (await res.json()) as { options: PickerOption[] } | ApiErr;

          if (!res.ok || !isOptionsOk(json)) {
            throw new Error(
              'error' in json && json.error ? json.error : 'Failed to load categories.'
            );
          }

          if (!cancelled) setCategoryOptions(json.options);
        }
      } catch (e) {
        if (!cancelled) setOptErr(fmtErr(e, 'Failed to load options.'));
      } finally {
        if (!cancelled) setOptLoading(false);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [open, targetType, productOptions.length, categoryOptions.length]);

  /* =====================
     Submit
     ===================== */
  function submit() {
    if (!canSubmit) return;

    const pool: OfferTargetRule[] = buildPool(targetType, productIds, categoryIds);

    const payload: OfferAdminForm['payload'] =
      kind === 'BOGOF'
        ? {
            kind: 'BOGOF',
            data: {
              buyQty,
              getQty: getQty ?? 1,
              buyPool: pool,
              getPool: pool,
              warnIfGetMoreExpensive: true,
              autoAddGetItem: true
            }
          }
        : kind === 'X_FOR_Y'
          ? {
              kind: 'X_FOR_Y',
              data: {
                buyQty,
                payQty: payQty ?? 1,
                pool
              }
            }
          : {
              kind: 'X_FOR_FIXED_PRICE',
              data: {
                qty: buyQty,
                pricePence: Math.max(0, Math.trunc(pricePence ?? 0)),
                pool
              }
            };

    const body: OfferAdminForm = {
      // id omitted on create (server generates)
      name: name.trim(),

      mode: 'AUTO',
      code: null,

      status: 'ACTIVE',
      startsAt: null,
      endsAt: null,

      stackingMode: 'HIGHEST_PRIORITY_WINS',
      priority: 0,

      maxDiscountPerOrderPence: null,
      preventFreeOrder: true,

      visibility: 'ALL',

      exclusions: {},

      payload
    };

    onCreate(body);
  }

  if (!open) return null;

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={styles.modalTitle}>Create offer</div>
            <div className={styles.modalSub}>
              Automatic deals like BOGOF / X-for-Y / X-for-£ (no coupon code).
            </div>

            <div className={styles.modalMetaRow}>
              <span className={styles.metaPill}>{summary.left}</span>
              {summary.right ? <span className={styles.metaPillSoft}>{summary.right}</span> : null}
            </div>
          </div>

          <button className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {optErr && <div className={styles.bannerError}>{optErr}</div>}

          <div className={styles.formGrid}>
            {/* Basics */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Basics</div>
                  <div className={styles.sectionHint}>Name the offer and choose a deal type.</div>
                </div>
              </div>

              <div className={styles.split2}>
                <div className={styles.field}>
                  <label className={styles.label}>Offer name</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 2 for £1"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Offer type</label>
                  <select
                    className={styles.select}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as AdminOfferKind)}
                  >
                    <option value="BOGOF">BOGOF (Buy X get Y free)</option>
                    <option value="X_FOR_Y">X for Y (Buy X pay for Y)</option>
                    <option value="X_FOR_FIXED_PRICE">X for £ (Buy X for fixed price)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Targeting */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Targeting</div>
                  <div className={styles.sectionHint}>
                    Decide which products this offer applies to.
                  </div>
                </div>
                {optLoading && targetType !== 'SITE_WIDE' ? (
                  <span className={styles.loadingPill}>Loading…</span>
                ) : null}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Applies to</label>
                <select
                  className={styles.select}
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as OfferTargetType)}
                >
                  <option value="SITE_WIDE">All products</option>
                  <option value="PRODUCTS">Specific products</option>
                  <option value="CATEGORIES">Specific categories</option>
                </select>

                {targetType !== 'SITE_WIDE' && !canSubmit && (
                  <div className={styles.hintInline}>
                    Select at least one {targetType === 'PRODUCTS' ? 'product' : 'category'} to
                    continue.
                  </div>
                )}
              </div>

              {targetType === 'PRODUCTS' && (
                <OfferTargetPicker
                  title="Products"
                  placeholder="Search products…"
                  options={productOptions}
                  selectedIds={productIds}
                  onChange={setProductIds}
                />
              )}

              {targetType === 'CATEGORIES' && (
                <OfferTargetPicker
                  title="Categories"
                  placeholder="Search categories…"
                  options={categoryOptions}
                  selectedIds={categoryIds}
                  onChange={setCategoryIds}
                />
              )}
            </div>

            {/* Rule */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Offer rule</div>
                  <div className={styles.sectionHint}>
                    Configure quantities / pricing for this deal.
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <OfferRuleBuilder
                  kind={kind}
                  buyQty={buyQty}
                  setBuyQty={setBuyQty}
                  getQty={getQty}
                  setGetQty={setGetQty}
                  payQty={payQty}
                  setPayQty={setPayQty}
                  pricePence={pricePence}
                  setPricePence={setPricePence}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.primaryBtn} onClick={submit} disabled={!canSubmit}>
            Create offer
          </button>
        </div>
      </div>
    </div>
  );
}
