'use client';

import type { OfferAdminForm, OfferKind, OfferTargetRule } from '@/types/offers';
import { useEffect, useMemo, useState } from 'react';
import OfferRuleBuilder from './OfferRuleBuilder';
import styles from './offers.module.scss';
import OfferTargetPicker, { type PickerOption } from './OfferTargetPicker';
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

function apiError(x: unknown): string | null {
  if (typeof x !== 'object' || x === null) return null;
  const r = x as Record<string, unknown>;
  return typeof r.error === 'string' && r.error.trim() ? r.error : null;
}

function clampInt(raw: string | number | null | undefined, min: number, max: number) {
  const n = typeof raw === 'number' ? raw : Number(raw ?? min);
  const x = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, x));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isSupportedKind(k: OfferKind): k is AdminOfferKind {
  return (
    k === 'BOGOF' ||
    k === 'X_FOR_Y' ||
    k === 'X_FOR_FIXED_PRICE' ||
    k === 'PERCENT_OFF' ||
    k === 'AMOUNT_OFF'
  );
}

function buildPool(targetType: OfferTargetType, productIds: string[], categoryIds: string[]) {
  if (targetType === 'SITE_WIDE') return selectionToPool({ targetType: 'SITE_WIDE' });

  if (targetType === 'PRODUCTS') {
    return selectionToPool({ targetType: 'PRODUCTS', productIds });
  }

  return selectionToPool({ targetType: 'CATEGORIES', categoryIds });
}

function deriveTargetFromPool(pool: OfferTargetRule[] | null | undefined): {
  targetType: OfferTargetType;
  productIds: string[];
  categoryIds: string[];
} {
  const rules = Array.isArray(pool) ? pool : [];
  if (!rules.length) return { targetType: 'SITE_WIDE', productIds: [], categoryIds: [] };

  if (rules.some((r) => r && r.type === 'ALL_PRODUCTS')) {
    return { targetType: 'SITE_WIDE', productIds: [], categoryIds: [] };
  }

  const productIds: string[] = [];
  const categoryIds: string[] = [];

  for (const r of rules) {
    if (!r) continue;

    if (r.type === 'PRODUCT_IDS') {
      for (const id of r.ids ?? []) {
        if (typeof id === 'string' && id) productIds.push(id);
      }
    }

    if (r.type === 'CATEGORY_IDS') {
      for (const id of r.ids ?? []) {
        if (typeof id === 'string' && id) categoryIds.push(id);
      }
    }
  }

  const uniq = (arr: string[]) => Array.from(new Set(arr.map((x) => String(x)).filter(Boolean)));

  if (productIds.length) {
    return { targetType: 'PRODUCTS', productIds: uniq(productIds), categoryIds: [] };
  }

  if (categoryIds.length) {
    return { targetType: 'CATEGORIES', productIds: [], categoryIds: uniq(categoryIds) };
  }

  return { targetType: 'SITE_WIDE', productIds: [], categoryIds: [] };
}

export default function EditOfferModal({
  open,
  offerId,
  onClose,
  onSaved
}: {
  open: boolean;
  offerId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [original, setOriginal] = useState<OfferAdminForm | null>(null);

  const [name, setName] = useState('');
  const [status, setStatus] = useState<OfferAdminForm['status']>('ACTIVE');
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [priority, setPriority] = useState<number>(0);

  const [kind, setKind] = useState<AdminOfferKind>('BOGOF');

  const [buyQty, setBuyQty] = useState(2);
  const [getQty, setGetQty] = useState<number | null>(1);
  const [payQty, setPayQty] = useState<number | null>(1);
  const [pricePence, setPricePence] = useState<number | null>(100);
  const [percent, setPercent] = useState<number | null>(10);

  const [targetType, setTargetType] = useState<OfferTargetType>('SITE_WIDE');
  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [productOptions, setProductOptions] = useState<PickerOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<PickerOption[]>([]);
  const [optErr, setOptErr] = useState<string | null>(null);
  const [optLoading, setOptLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    setLoadErr(null);
    setSaveErr(null);
    setOptErr(null);

    setOriginal(null);

    setName('');
    setStatus('ACTIVE');
    setStartsAt(null);
    setEndsAt(null);
    setPriority(0);

    setKind('BOGOF');

    setBuyQty(2);
    setGetQty(1);
    setPayQty(1);
    setPricePence(100);
    setPercent(10);

    setTargetType('SITE_WIDE');
    setProductIds([]);
    setCategoryIds([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!offerId) {
      setLoadErr('No offer selected.');
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadErr(null);

      try {
        const res = await fetch(`/api/admin/offers/${offerId}`, { cache: 'no-store' });
        const json = (await res.json().catch(() => null)) as unknown;

        if (!res.ok) throw new Error(apiError(json) ?? 'Failed to load offer.');
        if (!isRecord(json)) throw new Error('Failed to load offer.');

        const offer = (json as { offer?: unknown }).offer;
        if (!isRecord(offer)) throw new Error('Failed to load offer.');

        const o = offer as unknown as OfferAdminForm;
        if (cancelled) return;

        setOriginal(o);

        setName(o.name ?? '');
        setStatus(o.status ?? 'ACTIVE');
        setStartsAt(o.startsAt ?? null);
        setEndsAt(o.endsAt ?? null);
        setPriority(Number.isFinite(o.priority) ? Math.trunc(o.priority) : 0);

        const pk = o.payload?.kind;

        if (pk && isSupportedKind(pk)) {
          setKind(pk);

          let pool: OfferTargetRule[] | undefined;

          if (pk === 'BOGOF') {
            pool = o.payload.data.buyPool;
          } else if (
            pk === 'PERCENT_OFF' ||
            pk === 'AMOUNT_OFF' ||
            pk === 'X_FOR_Y' ||
            pk === 'X_FOR_FIXED_PRICE'
          ) {
            pool = o.payload.data.pool;
          } else {
            pool = undefined;
          }

          const derived = deriveTargetFromPool(pool);
          setTargetType(derived.targetType);
          setProductIds(derived.productIds);
          setCategoryIds(derived.categoryIds);

          if (pk === 'BOGOF') {
            setBuyQty(clampInt(o.payload.data.buyQty, 1, 999));
            setGetQty(clampInt(o.payload.data.getQty, 1, 999));
            setPayQty(null);
            setPricePence(null);
            setPercent(null);
          }

          if (pk === 'X_FOR_Y') {
            setBuyQty(clampInt(o.payload.data.buyQty, 1, 999));
            setPayQty(clampInt(o.payload.data.payQty, 1, 999));
            setGetQty(null);
            setPricePence(null);
            setPercent(null);
          }

          if (pk === 'X_FOR_FIXED_PRICE') {
            setBuyQty(clampInt(o.payload.data.qty, 1, 999));
            setPricePence(
              typeof o.payload.data.pricePence === 'number'
                ? Math.max(0, Math.trunc(o.payload.data.pricePence))
                : 0
            );
            setGetQty(null);
            setPayQty(null);
            setPercent(null);
          }

          if (pk === 'PERCENT_OFF') {
            const pct =
              typeof (o.payload.data as { percent?: number }).percent === 'number'
                ? Math.trunc((o.payload.data as { percent?: number }).percent ?? 0)
                : 0;
            setPercent(Math.max(0, Math.min(100, pct)));
            setGetQty(null);
            setPayQty(null);
            setPricePence(null);
          }

          if (pk === 'AMOUNT_OFF') {
            const amt =
              typeof (o.payload.data as { amountPence?: number }).amountPence === 'number'
                ? Math.max(
                    0,
                    Math.trunc((o.payload.data as { amountPence?: number }).amountPence ?? 0)
                  )
                : 0;
            setPricePence(amt);
            setGetQty(null);
            setPayQty(null);
            setPercent(null);
          }
        } else {
          setTargetType('SITE_WIDE');
          setProductIds([]);
          setCategoryIds([]);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(fmtErr(e, 'Failed to load offer.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [open, offerId]);

  const supported = useMemo(() => {
    const pk = original?.payload?.kind;
    return pk ? isSupportedKind(pk) : true;
  }, [original]);

  useEffect(() => {
    if (!open || !supported) return;

    if (kind === 'BOGOF') {
      setPayQty(null);
      setPricePence(null);
      setPercent(null);
      setGetQty((v) => v ?? 1);
      setBuyQty((v) => v || 2);
      return;
    }

    if (kind === 'X_FOR_Y') {
      setGetQty(null);
      setPricePence(null);
      setPercent(null);
      setPayQty((v) => v ?? 1);
      setBuyQty((v) => v || 2);
      return;
    }

    if (kind === 'X_FOR_FIXED_PRICE') {
      setGetQty(null);
      setPayQty(null);
      setPercent(null);
      setPricePence((v) => v ?? 100);
      setBuyQty((v) => v || 2);
      return;
    }

    if (kind === 'PERCENT_OFF') {
      setGetQty(null);
      setPayQty(null);
      setPricePence(null);
      setPercent((v) => v ?? 10);
      return;
    }

    setGetQty(null);
    setPayQty(null);
    setPercent(null);
    setPricePence((v) => v ?? 100);
  }, [open, kind, supported]);

  useEffect(() => {
    if (!open || !supported) return;

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
  }, [open, targetType, supported]);

  useEffect(() => {
    if (!open || !supported || targetType === 'SITE_WIDE') return;

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
  }, [open, supported, targetType, productOptions.length, categoryOptions.length]);

  const canSubmit = useMemo(() => {
    if (!offerId) return false;
    if (loading || saving) return false;
    if (!name.trim()) return false;
    if (!original) return false;

    if (!supported) return true;

    if (targetType === 'PRODUCTS' && productIds.length === 0) return false;
    if (targetType === 'CATEGORIES' && categoryIds.length === 0) return false;

    if (kind === 'PERCENT_OFF') return (percent ?? 0) > 0;
    if (kind === 'AMOUNT_OFF') return (pricePence ?? 0) > 0;

    return true;
  }, [
    offerId,
    loading,
    saving,
    name,
    original,
    supported,
    targetType,
    productIds.length,
    categoryIds.length,
    kind,
    percent,
    pricePence
  ]);

  async function save() {
    if (!canSubmit || !offerId || !original) return;

    setSaveErr(null);
    setSaving(true);

    try {
      const next: OfferAdminForm = {
        ...original,
        name: name.trim(),
        status,
        startsAt: startsAt?.trim() ? startsAt.trim() : null,
        endsAt: endsAt?.trim() ? endsAt.trim() : null,
        priority: Number.isFinite(priority) ? Math.trunc(priority) : 0,
        exclusions: original.exclusions ?? {}
      };

      if (supported) {
        const pool = buildPool(targetType, productIds, categoryIds);

        const payload: OfferAdminForm['payload'] =
          kind === 'BOGOF'
            ? {
                kind: 'BOGOF',
                data: {
                  buyQty: clampInt(buyQty, 1, 999),
                  getQty: clampInt(getQty ?? 1, 1, 999),
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
                    buyQty: clampInt(buyQty, 1, 999),
                    payQty: clampInt(payQty ?? 1, 1, 999),
                    pool
                  }
                }
              : kind === 'X_FOR_FIXED_PRICE'
                ? {
                    kind: 'X_FOR_FIXED_PRICE',
                    data: {
                      qty: clampInt(buyQty, 1, 999),
                      pricePence: Math.max(0, Math.trunc(pricePence ?? 0)),
                      pool
                    }
                  }
                : kind === 'PERCENT_OFF'
                  ? {
                      kind: 'PERCENT_OFF',
                      data: {
                        percent: Math.max(0, Math.min(100, Math.trunc(percent ?? 0))),
                        pool
                      }
                    }
                  : {
                      kind: 'AMOUNT_OFF',
                      data: {
                        amountPence: Math.max(0, Math.trunc(pricePence ?? 0)),
                        pool
                      }
                    };

        next.payload = payload;
      }

      const res = await fetch(`/api/admin/offers/${offerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });

      const json = (await res.json().catch(() => null)) as unknown;
      if (!res.ok) throw new Error(apiError(json) ?? 'Failed to save.');

      onSaved();
      onClose();
    } catch (e) {
      setSaveErr(fmtErr(e, 'Failed to save offer.'));
    } finally {
      setSaving(false);
    }
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
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <div className={styles.modalTitle}>Edit offer</div>
            <div className={styles.modalSub}>Update and save changes.</div>

            {optLoading && supported && targetType !== 'SITE_WIDE' ? (
              <div className={styles.modalMetaRow}>
                <span className={styles.loadingPill}>Loading…</span>
              </div>
            ) : null}
          </div>

          <button className={styles.iconBtn} onClick={onClose} aria-label="Close" type="button">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loadErr && <div className={styles.bannerError}>{loadErr}</div>}
          {saveErr && <div className={styles.bannerError}>{saveErr}</div>}
          {optErr && <div className={styles.bannerError}>{optErr}</div>}

          <div className={styles.formGrid}>
            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Basics</div>
                  <div className={styles.sectionHint}>Name, status, priority and window.</div>
                </div>
              </div>

              <div className={styles.split2}>
                <div className={styles.field}>
                  <label className={styles.label}>Offer name</label>
                  <input
                    className={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading || saving}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OfferAdminForm['status'])}
                    disabled={loading || saving}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PAUSED">PAUSED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Priority</label>
                  <input
                    className={styles.input}
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(clampInt(e.target.value, -999999, 999999))}
                    disabled={loading || saving}
                  />
                  <div className={styles.hint}>Higher runs first if stacking requires.</div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Starts at (ISO)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 2026-02-12T10:00:00.000Z"
                    value={startsAt ?? ''}
                    onChange={(e) => setStartsAt(e.target.value.trim() ? e.target.value : null)}
                    disabled={loading || saving}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.label}>Ends at (ISO)</label>
                  <input
                    className={styles.input}
                    placeholder="e.g. 2026-03-01T23:59:59.000Z"
                    value={endsAt ?? ''}
                    onChange={(e) => setEndsAt(e.target.value.trim() ? e.target.value : null)}
                    disabled={loading || saving}
                  />
                </div>
              </div>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Targeting</div>
                  <div className={styles.sectionHint}>
                    {supported
                      ? 'Decide which products this offer applies to.'
                      : 'This offer kind is not editable in the UI yet (targeting will be preserved).'}
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Applies to</label>
                <select
                  className={styles.select}
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as OfferTargetType)}
                  disabled={!supported || loading || saving}
                >
                  <option value="SITE_WIDE">All products</option>
                  <option value="PRODUCTS">Specific products</option>
                  <option value="CATEGORIES">Specific categories</option>
                </select>

                {supported &&
                targetType !== 'SITE_WIDE' &&
                (targetType === 'PRODUCTS' ? productIds.length === 0 : categoryIds.length === 0) ? (
                  <div className={styles.hintInline}>
                    Select at least one {targetType === 'PRODUCTS' ? 'product' : 'category'} to
                    continue.
                  </div>
                ) : null}
              </div>

              {supported && targetType === 'PRODUCTS' ? (
                <OfferTargetPicker
                  title="Products"
                  placeholder="Search products…"
                  options={productOptions}
                  selectedIds={productIds}
                  onChange={setProductIds}
                />
              ) : null}

              {supported && targetType === 'CATEGORIES' ? (
                <OfferTargetPicker
                  title="Categories"
                  placeholder="Search categories…"
                  options={categoryOptions}
                  selectedIds={categoryIds}
                  onChange={setCategoryIds}
                />
              ) : null}
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Offer rule</div>
                  <div className={styles.sectionHint}>
                    {supported
                      ? 'Configure quantities / pricing for this deal.'
                      : 'This offer kind is not editable in the UI yet (payload will be preserved).'}
                  </div>
                </div>
              </div>

              <div className={styles.split2}>
                <div className={styles.field}>
                  <label className={styles.label}>Offer type</label>
                  <select
                    className={styles.select}
                    value={kind}
                    onChange={(e) => setKind(e.target.value as AdminOfferKind)}
                    disabled={!supported || loading || saving}
                  >
                    <option value="BOGOF">BOGOF (Buy X get Y free)</option>
                    <option value="X_FOR_Y">X for Y (Buy X pay for Y)</option>
                    <option value="X_FOR_FIXED_PRICE">X for £ (Buy X for fixed price)</option>
                    <option value="PERCENT_OFF">% off (Percent discount)</option>
                    <option value="AMOUNT_OFF">£ off (Fixed amount discount)</option>
                  </select>
                </div>

                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
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
                    percent={percent}
                    setPercent={setPercent}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>

          <button className={styles.primaryBtn} onClick={save} disabled={!canSubmit}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
