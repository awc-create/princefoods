'use client';

import { useEffect, useMemo, useState } from 'react';
import OfferRuleBuilder from './OfferRuleBuilder';
import OfferTargetPicker, { type PickerOption as TargetPickerOption } from './OfferTargetPicker';
import styles from './offers.module.scss';

import MultiPicker from '@/components/admin/promotions/MultiPicker';
import type { PickerOption as CustomerPickerOption } from '@/components/admin/promotions/types';

import type { OfferAdminForm, OfferTargetRule } from '@/types/offers';
import type { AdminOfferKind, OfferTargetType } from './types';
import { selectionToPool } from './types';

interface ApiErr {
  error: string;
}

type OfferEmailScope = 'ALL_CUSTOMERS' | 'SELECTED_USERS';

function isOptionsOk(x: unknown): x is { options: TargetPickerOption[] } {
  return (
    typeof x === 'object' &&
    x !== null &&
    'options' in x &&
    Array.isArray((x as { options?: unknown }).options)
  );
}

function isCustomerOptionsOk(x: unknown): x is { options: CustomerPickerOption[] } {
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
  if (kind === 'X_FOR_FIXED_PRICE') return 'X for £';
  if (kind === 'PERCENT_OFF') return '% off';
  return '£ off';
}

function targetLabel(t: OfferTargetType) {
  if (t === 'SITE_WIDE') return 'All products';
  if (t === 'PRODUCTS') return 'Specific products';
  return 'Specific categories';
}

function buildPool(targetType: OfferTargetType, productIds: string[], categoryIds: string[]) {
  if (targetType === 'SITE_WIDE') {
    return selectionToPool({ targetType: 'SITE_WIDE' });
  }

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
  onCreate: (body: OfferAdminForm) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<AdminOfferKind>('BOGOF');
  const [targetType, setTargetType] = useState<OfferTargetType>('SITE_WIDE');

  const [buyQty, setBuyQty] = useState(2);
  const [getQty, setGetQty] = useState<number | null>(1);
  const [payQty, setPayQty] = useState<number | null>(1);
  const [pricePence, setPricePence] = useState<number | null>(100);
  const [percent, setPercent] = useState<number | null>(10);

  const [productIds, setProductIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  const [productOptions, setProductOptions] = useState<TargetPickerOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<TargetPickerOption[]>([]);
  const [optErr, setOptErr] = useState<string | null>(null);
  const [optLoading, setOptLoading] = useState(false);

  const [emailAfterCreate, setEmailAfterCreate] = useState(false);
  const [emailScope, setEmailScope] = useState<OfferEmailScope>('SELECTED_USERS');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailSelectedUserIds, setEmailSelectedUserIds] = useState<string[]>([]);

  const [customerOptions, setCustomerOptions] = useState<CustomerPickerOption[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [localErr, setLocalErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function searchCustomers(q: string) {
    setCustomerError(null);
    setCustomerLoading(true);

    try {
      const url = new URL('/api/admin/options/customers', window.location.origin);
      url.searchParams.set('q', q);
      url.searchParams.set('take', '200');

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as
        | { options: CustomerPickerOption[] }
        | ApiErr
        | null;

      if (!res.ok || !json || !isCustomerOptionsOk(json)) {
        const msg =
          json && 'error' in json && typeof json.error === 'string'
            ? json.error
            : 'Failed to load customers.';
        throw new Error(msg);
      }

      setCustomerOptions(json.options);
    } catch (e) {
      setCustomerError(fmtErr(e, 'Failed to load customers.'));
      setCustomerOptions([]);
    } finally {
      setCustomerLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;

    setName('');
    setKind('BOGOF');
    setTargetType('SITE_WIDE');

    setBuyQty(2);
    setGetQty(1);
    setPayQty(1);
    setPricePence(100);
    setPercent(10);

    setProductIds([]);
    setCategoryIds([]);

    setProductOptions([]);
    setCategoryOptions([]);
    setOptErr(null);
    setOptLoading(false);

    setEmailAfterCreate(false);
    setEmailScope('SELECTED_USERS');
    setEmailSubject('');
    setEmailMessage('');
    setEmailSelectedUserIds([]);

    setCustomerOptions([]);
    setCustomerLoading(false);
    setCustomerError(null);

    setLocalErr(null);
    setCreating(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!emailAfterCreate) {
      setEmailScope('SELECTED_USERS');
      setEmailSubject('');
      setEmailMessage('');
      setEmailSelectedUserIds([]);
      setCustomerOptions([]);
      return;
    }

    if (emailScope === 'ALL_CUSTOMERS') {
      setEmailSelectedUserIds([]);
      return;
    }

    if (emailScope === 'SELECTED_USERS') {
      void searchCustomers('');
    }
  }, [open, emailAfterCreate, emailScope]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, kind]);

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
          const json = (await res.json()) as { options: TargetPickerOption[] } | ApiErr;

          if (!res.ok || !isOptionsOk(json)) {
            throw new Error(
              'error' in json && typeof json.error === 'string'
                ? json.error
                : 'Failed to load products.'
            );
          }

          if (!cancelled) setProductOptions(json.options);
        }

        if (targetType === 'CATEGORIES' && categoryOptions.length === 0) {
          const res = await fetch('/api/admin/offers/options/categories', { cache: 'no-store' });
          const json = (await res.json()) as { options: TargetPickerOption[] } | ApiErr;

          if (!res.ok || !isOptionsOk(json)) {
            throw new Error(
              'error' in json && typeof json.error === 'string'
                ? json.error
                : 'Failed to load categories.'
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

  const canSubmit = useMemo(() => {
    if (!name.trim()) return false;

    if (targetType === 'PRODUCTS' && productIds.length === 0) return false;
    if (targetType === 'CATEGORIES' && categoryIds.length === 0) return false;

    if (kind === 'PERCENT_OFF' && (percent ?? 0) <= 0) return false;
    if (kind === 'AMOUNT_OFF' && (pricePence ?? 0) <= 0) return false;

    if (emailAfterCreate) {
      if (!emailSubject.trim()) return false;
      if (emailScope === 'SELECTED_USERS' && emailSelectedUserIds.length === 0) return false;
    }

    return true;
  }, [
    name,
    targetType,
    productIds.length,
    categoryIds.length,
    kind,
    percent,
    pricePence,
    emailAfterCreate,
    emailScope,
    emailSubject,
    emailSelectedUserIds.length
  ]);

  const summary = useMemo(() => {
    const left = `${kindLabel(kind)} • ${targetLabel(targetType)}`;
    let right = '';

    if (targetType === 'PRODUCTS') right = `${productIds.length} selected`;
    if (targetType === 'CATEGORIES') right = `${categoryIds.length} selected`;

    return { left, right };
  }, [kind, targetType, productIds.length, categoryIds.length]);

  async function submit() {
    setLocalErr(null);

    if (!name.trim()) {
      setLocalErr('Offer name is required.');
      return;
    }

    if (targetType === 'PRODUCTS' && productIds.length === 0) {
      setLocalErr('Select at least 1 product.');
      return;
    }

    if (targetType === 'CATEGORIES' && categoryIds.length === 0) {
      setLocalErr('Select at least 1 category.');
      return;
    }

    if (kind === 'PERCENT_OFF' && (percent ?? 0) <= 0) {
      setLocalErr('Enter a valid percent greater than 0.');
      return;
    }

    if (kind === 'AMOUNT_OFF' && (pricePence ?? 0) <= 0) {
      setLocalErr('Enter a valid discount amount greater than 0.');
      return;
    }

    if (emailAfterCreate) {
      if (!emailSubject.trim()) {
        setLocalErr('Email subject is required.');
        return;
      }

      if (emailScope === 'SELECTED_USERS' && emailSelectedUserIds.length === 0) {
        setLocalErr('Select at least 1 customer.');
        return;
      }
    }

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
          : kind === 'X_FOR_FIXED_PRICE'
            ? {
                kind: 'X_FOR_FIXED_PRICE',
                data: {
                  qty: buyQty,
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

    const body: OfferAdminForm = {
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
      payload,

      bannerEnabled: false,
      bannerTitle: null,
      bannerMessage: null,
      bannerCtaLabel: null,
      bannerCtaHref: null,
      bannerStartsAt: null,
      bannerEndsAt: null,

      emailEnabled: emailAfterCreate,
      emailSubject: emailAfterCreate ? emailSubject.trim() : null,
      emailMessage: emailAfterCreate ? emailMessage.trim() || null : null,

      blastEnabled: emailAfterCreate ? true : undefined,
      blastScope: emailAfterCreate ? emailScope : undefined,
      blastUserIds: emailAfterCreate
        ? emailScope === 'SELECTED_USERS'
          ? emailSelectedUserIds
          : []
        : undefined
    };

    try {
      setCreating(true);
      await onCreate(body);
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Failed to create offer.');
    } finally {
      setCreating(false);
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
            <div className={styles.modalTitle}>Create offer</div>
            <div className={styles.modalSub}>
              Automatic deals like BOGOF / X-for-Y / X-for-£ / % off / £ off (no coupon code).
            </div>

            <div className={styles.modalMetaRow}>
              <span className={styles.metaPill}>{summary.left}</span>
              {summary.right ? <span className={styles.metaPillSoft}>{summary.right}</span> : null}
            </div>
          </div>

          <button className={styles.iconBtn} onClick={onClose} aria-label="Close" type="button">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {optErr ? <div className={styles.bannerError}>{optErr}</div> : null}

          <div className={styles.formGrid}>
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
                    placeholder="e.g. Weekend frozen deal"
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
                    <option value="PERCENT_OFF">% off</option>
                    <option value="AMOUNT_OFF">£ off</option>
                  </select>
                </div>
              </div>
            </div>

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
              </div>

              {targetType === 'PRODUCTS' ? (
                <OfferTargetPicker
                  title="Products"
                  placeholder="Search products…"
                  options={productOptions}
                  selectedIds={productIds}
                  onChange={setProductIds}
                />
              ) : null}

              {targetType === 'CATEGORIES' ? (
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
                  percent={percent}
                  setPercent={setPercent}
                />
              </div>
            </div>

            <div className={styles.sectionCard}>
              <div className={styles.sectionHead}>
                <div>
                  <div className={styles.sectionTitle}>Email after create</div>
                  <div className={styles.sectionHint}>
                    Send to selected customers (or all customers). You can email again later too.
                  </div>
                </div>
              </div>

              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={emailAfterCreate}
                  onChange={(e) => setEmailAfterCreate(e.target.checked)}
                />
                <span>
                  <strong>Email offer after creating</strong>
                </span>
              </label>

              {emailAfterCreate ? (
                <div className={styles.formGrid} style={{ marginTop: 10 }}>
                  <div className={styles.split2}>
                    <div className={styles.field}>
                      <label className={styles.label}>Send to</label>
                      <select
                        className={styles.select}
                        value={emailScope}
                        onChange={(e) => setEmailScope(e.target.value as OfferEmailScope)}
                      >
                        <option value="SELECTED_USERS">Selected customers</option>
                        <option value="ALL_CUSTOMERS">All customers</option>
                      </select>
                    </div>

                    <div className={styles.field}>
                      <label className={styles.label}>Email subject</label>
                      <input
                        className={styles.input}
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="e.g. Prince Foods new offer"
                      />
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.label}>Message (optional)</label>
                    <textarea
                      className={(styles as Record<string, string>).textarea ?? styles.input}
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Optional message shown above the offer"
                      rows={4}
                    />
                  </div>

                  {emailScope === 'SELECTED_USERS' ? (
                    <MultiPicker
                      title="Select customers"
                      placeholder="Search customers…"
                      options={customerOptions}
                      selectedIds={emailSelectedUserIds}
                      onChange={setEmailSelectedUserIds}
                      remote
                      minChars={0}
                      onRemoteSearch={searchCustomers}
                      remoteLoading={customerLoading}
                      remoteError={customerError}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {localErr ? <div className={styles.bannerError}>{localErr}</div> : null}

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => void submit()}
            disabled={creating || !canSubmit}
          >
            {creating ? 'Creating…' : 'Create offer'}
          </button>
        </div>
      </div>
    </div>
  );
}
