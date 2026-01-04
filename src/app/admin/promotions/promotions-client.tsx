'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './promotions.module.scss';

type PromotionStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED';
type PromotionType = 'CODE' | 'GIFT';
type DiscountType = 'PERCENT' | 'AMOUNT' | 'PRODUCT_100';
type TargetType = 'SITE_WIDE' | 'CATEGORIES' | 'PRODUCTS';

type PromoKindUI = 'AMOUNT_OFF' | 'PERCENT_OFF' | 'FREE_SHIPPING';

interface PromotionRow {
  id: string;
  name: string;
  code: string;
  type: PromotionType;
  status: PromotionStatus;

  discountType: DiscountType;
  percentOff: number | null;
  amountOffPence: number | null;

  applyShippingDiscount: boolean;
  shippingPercentOffDry: number | null;
  shippingPercentOffFrozen: number | null;

  targetType: TargetType;

  startsAt: string | null;
  endsAt: string | null;
  maxUsesTotal: number | null;
  maxUsesPerUser: number | null;

  createdAt: string;
  updatedAt: string;

  redemptionCount: number;
}

interface ApiListOk {
  ok: true;
  promotions: PromotionRow[];
}
interface ApiErr {
  ok: false;
  error: string;
}

interface CreateBody {
  name: string;
  code: string;
  type: PromotionType;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;

  maxUsesTotal: number | null;
  maxUsesPerUser: number | null;

  targetType: TargetType;

  discountType: DiscountType;
  percentOff?: number | null;
  amountOffPence?: number | null;

  applyShippingDiscount?: boolean;
  shippingPercentOffDry?: number | null;
  shippingPercentOffFrozen?: number | null;

  categoryIds?: string[];
  productIds?: string[];
}

type UsageOutcome = 'APPLIED' | 'REJECTED';

interface UsageAttemptRow {
  id: string;
  code: string;
  outcome: UsageOutcome;
  errorCode: string | null;
  email: string | null;
  userId: string | null;
  createdAt: string;

  currency: string;
  subtotalPence: number | null;
  shippingPence: number | null;
  discountPence: number;
  shippingDiscountPence: number;

  promotionId: string | null;
  promotionName: string | null;

  orderId: string | null;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;

  redeemedOnOrder: boolean;
}

interface UsageRedemptionRow {
  id: string;
  code: string;
  promotionId: string;
  promotionName: string | null;
  orderId: string;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  email: string | null;
  userId: string | null;
  createdAt: string;
}

interface UsageApiOk {
  ok: true;
  since: string;
  attempts: UsageAttemptRow[];
  redemptions: UsageRedemptionRow[];
}

/** Promotion detail returned by GET /api/admin/promotions/[id] */
interface PromotionDetail {
  id: string;
  name: string;
  code: string;
  status: PromotionStatus;
  startsAt: string | null;
  endsAt: string | null;
}
type PromotionPatch = Partial<Pick<PromotionDetail, 'name' | 'status' | 'startsAt' | 'endsAt'>>;

interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}

interface OptionsApiOk {
  ok: true;
  categories: Array<{ id: string; name: string }>;
  products: Array<{ id: string; name: string; sku: string | null }>;
}

function normCode(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString();
}

function fmtDateTime(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString();
}

function clampInt(n: number, min: number, max: number) {
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

function poundsToPence(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t);
  if (!Number.isFinite(x) || x < 0) return null;
  return Math.round(x * 100);
}

function toIntOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const x = Number(t);
  if (!Number.isFinite(x)) return null;
  return Math.trunc(x);
}

function discountLabel(p: PromotionRow) {
  if (p.discountType === 'PERCENT') return `${p.percentOff ?? 0}% OFF`;
  if (p.discountType === 'AMOUNT') return `£${((p.amountOffPence ?? 0) / 100).toFixed(2)} OFF`;
  if (p.discountType === 'PRODUCT_100') return `100% OFF`;
  return '—';
}

function targetLabel(p: PromotionRow) {
  if (p.targetType === 'SITE_WIDE') return 'All products';
  if (p.targetType === 'CATEGORIES') return 'Categories';
  if (p.targetType === 'PRODUCTS') return 'Products';
  return '—';
}

function statusPillClass(s: PromotionStatus) {
  if (s === 'ACTIVE') return styles.pillActive;
  if (s === 'PAUSED') return styles.pillPaused;
  return styles.pillExpired;
}

function kindToDiscountType(kind: PromoKindUI): DiscountType {
  if (kind === 'PERCENT_OFF') return 'PERCENT';
  if (kind === 'AMOUNT_OFF') return 'AMOUNT';
  return 'AMOUNT';
}

function isoToDateInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function penceToGBP(p: number) {
  const x = Math.max(0, Math.trunc(p));
  return `£${(x / 100).toFixed(2)}`;
}

function usageStatusLabel(a: UsageAttemptRow) {
  if (a.outcome === 'REJECTED') return 'Rejected';
  if (!a.orderId) return 'Applied (no order)';
  if (!a.orderPaymentStatus) return 'Applied (order created)';
  if (a.orderPaymentStatus !== 'CAPTURED') return `Applied (order ${a.orderPaymentStatus})`;
  return a.redeemedOnOrder ? 'Redeemed' : 'Applied (not used on payment)';
}

function dedupeIds(ids: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const k = id.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function MultiPicker({
  title,
  placeholder,
  options,
  selectedIds,
  onChange
}: {
  title: string;
  placeholder: string;
  options: PickerOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selected = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as PickerOption[];
  }, [options, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter((o) => {
          const blob = `${o.label} ${o.meta ?? ''}`.toLowerCase();
          return blob.includes(q);
        })
      : options;

    // Don’t show already-selected options in the list
    return base.filter((o) => !selectedSet.has(o.id)).slice(0, 80);
  }, [options, query, selectedSet]);

  function add(id: string) {
    onChange(dedupeIds([...selectedIds, id]));
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className={styles.pickerBlock}>
      <div className={styles.pickerTitleRow}>
        <div className={styles.label}>{title}</div>
        <div className={styles.hint}>{selectedIds.length} selected</div>
      </div>

      {selected.length > 0 && (
        <div className={styles.chipRow}>
          {selected.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.chip}
              onClick={() => remove(o.id)}
              title="Remove"
            >
              <span className={styles.chipText}>{o.label}</span>
              {o.meta ? <span className={styles.chipMeta}>{o.meta}</span> : null}
              <span className={styles.chipX}>✕</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.pickerSearchRow}>
        <input
          className={styles.search}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.pickerList}>
        {filtered.length === 0 ? (
          <div className={styles.pickerEmpty}>No matches.</div>
        ) : (
          filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.pickerItem}
              onClick={() => add(o.id)}
            >
              <div className={styles.pickerItemMain}>{o.label}</div>
              {o.meta ? <div className={styles.pickerItemSub}>{o.meta}</div> : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function PromotionsClient() {
  const [tab, setTab] = useState<'promos' | 'usage'>('promos');

  // ===== promos list =====
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PromotionStatus>('ALL');

  const [open, setOpen] = useState(false);

  // create modal state
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
  const [saving, setSaving] = useState(false);

  // picker state
  const [optsLoading, setOptsLoading] = useState(false);
  const [optsErr, setOptsErr] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<PickerOption[]>([]);
  const [productOptions, setProductOptions] = useState<PickerOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const dialogBodyRef = useRef<HTMLDivElement | null>(null);

  // ===== edit modal =====
  const [editId, setEditId] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editData, setEditData] = useState<PromotionDetail | null>(null);

  // ===== usage =====
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageErr, setUsageErr] = useState<string | null>(null);
  const [usageDays, setUsageDays] = useState('30');
  const [attempts, setAttempts] = useState<UsageAttemptRow[]>([]);
  const [redemptions, setRedemptions] = useState<UsageRedemptionRow[]>([]);

  const [usageView, setUsageView] = useState<'attempts' | 'redemptions'>('attempts');

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/promotions', { cache: 'no-store' });
      const json = (await res.json()) as ApiListOk | ApiErr;

      if (!res.ok || !json.ok) {
        setErr((json as ApiErr).error ?? 'Failed to load promotions.');
        setRows([]);
        return;
      }

      setRows((json as ApiListOk).promotions ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load promotions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    setOptsErr(null);
    setOptsLoading(true);

    try {
      const res = await fetch('/api/admin/promotions/options', { cache: 'no-store' });
      const json = (await res.json()) as OptionsApiOk | ApiErr;

      if (!res.ok || !('ok' in json) || !json.ok) {
        setOptsErr((json as ApiErr).error ?? 'Failed to load categories/products.');
        setCategoryOptions([]);
        setProductOptions([]);
        return;
      }

      const ok = json as OptionsApiOk;
      setCategoryOptions(
        (ok.categories ?? []).map((c) => ({
          id: c.id,
          label: c.name
        }))
      );

      setProductOptions(
        (ok.products ?? []).map((p) => ({
          id: p.id,
          label: p.name,
          meta: p.sku ? `SKU ${p.sku}` : undefined
        }))
      );
    } catch (e) {
      setOptsErr(e instanceof Error ? e.message : 'Failed to load categories/products.');
      setCategoryOptions([]);
      setProductOptions([]);
    } finally {
      setOptsLoading(false);
    }
  }

  async function loadUsage() {
    setUsageErr(null);
    setUsageLoading(true);
    try {
      const days = Math.max(1, Math.min(365, Number(usageDays || '30')));
      const res = await fetch(`/api/admin/promotions/usage?days=${days}`, { cache: 'no-store' });
      const json = (await res.json()) as UsageApiOk | ApiErr;

      if (!res.ok || !json.ok) {
        setUsageErr((json as ApiErr).error ?? 'Failed to load usage.');
        setAttempts([]);
        setRedemptions([]);
        return;
      }

      const ok = json as UsageApiOk;
      setAttempts(ok.attempts ?? []);
      setRedemptions(ok.redemptions ?? []);
    } catch (e) {
      setUsageErr(e instanceof Error ? e.message : 'Failed to load usage.');
      setAttempts([]);
      setRedemptions([]);
    } finally {
      setUsageLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows
      .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
      .filter((r) => {
        if (!query) return true;
        const blob = [
          r.name,
          r.code,
          r.status,
          r.type,
          r.discountType,
          targetLabel(r),
          discountLabel(r)
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(query);
      });
  }, [rows, q, statusFilter]);

  const usageSummary = useMemo(() => {
    const totalAttempts = attempts.length;
    const applied = attempts.filter((a) => a.outcome === 'APPLIED').length;
    const rejected = attempts.filter((a) => a.outcome === 'REJECTED').length;
    const redeemed = attempts.filter((a) => a.redeemedOnOrder).length;

    const appliedNotUsedOnPayment = attempts.filter(
      (a) => a.outcome === 'APPLIED' && a.orderPaymentStatus === 'CAPTURED' && !a.redeemedOnOrder
    ).length;

    const appliedNoOrder = attempts.filter((a) => a.outcome === 'APPLIED' && !a.orderId).length;

    return { totalAttempts, applied, rejected, redeemed, appliedNotUsedOnPayment, appliedNoOrder };
  }, [attempts]);

  function resetModal() {
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
    setErr(null);
    setOptsErr(null);
  }

  function openModal() {
    resetModal();
    setOpen(true);

    window.setTimeout(() => {
      dialogBodyRef.current?.scrollTo({ top: 0 });
    }, 0);

    // load options on open (MVP)
    void loadOptions();
  }

  function closeModal() {
    setOpen(false);
  }

  useEffect(() => {
    if (promoKind === 'FREE_SHIPPING') {
      setApplyShipping(true);
      setShippingPct('100');
      setDiscountValue('');
    }
  }, [promoKind]);

  useEffect(() => {
    // clean selections when switching target
    if (targetType === 'SITE_WIDE') {
      setSelectedCategoryIds([]);
      setSelectedProductIds([]);
    }
    if (targetType === 'CATEGORIES') {
      setSelectedProductIds([]);
    }
    if (targetType === 'PRODUCTS') {
      setSelectedCategoryIds([]);
    }
  }, [targetType]);

  async function createPromo() {
    setErr(null);

    const c = normCode(code);
    const n = name.trim();

    if (!c) return setErr('Promo code is required.');
    if (!n) return setErr('Promo name is required.');

    if (targetType === 'CATEGORIES' && selectedCategoryIds.length === 0) {
      return setErr('Select at least 1 category.');
    }
    if (targetType === 'PRODUCTS' && selectedProductIds.length === 0) {
      return setErr('Select at least 1 product.');
    }

    const kindDiscountType = kindToDiscountType(promoKind);

    let percentOff: number | null | undefined = undefined;
    let amountOffPence: number | null | undefined = undefined;

    if (promoKind === 'PERCENT_OFF') {
      const pct = toIntOrNull(discountValue);
      if (pct == null) return setErr('Enter a valid percent.');
      percentOff = clampInt(pct, 0, 100);
    } else if (promoKind === 'AMOUNT_OFF') {
      const pence = poundsToPence(discountValue);
      if (pence == null) return setErr('Enter a valid amount.');
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

      discountType: kindDiscountType,
      ...(percentOff !== undefined ? { percentOff } : {}),
      ...(amountOffPence !== undefined ? { amountOffPence } : {}),

      applyShippingDiscount: applyShipping || promoKind === 'FREE_SHIPPING',
      shippingPercentOffDry: applyShipping || promoKind === 'FREE_SHIPPING' ? shipPctClamped : null,
      shippingPercentOffFrozen:
        applyShipping || promoKind === 'FREE_SHIPPING' ? shipPctClamped : null,

      categoryIds: targetType === 'CATEGORIES' ? dedupeIds(selectedCategoryIds) : [],
      productIds: targetType === 'PRODUCTS' ? dedupeIds(selectedProductIds) : []
    };

    setSaving(true);
    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setErr(json.error ?? 'Failed to create promotion.');
        return;
      }

      closeModal();
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create promotion.');
    } finally {
      setSaving(false);
    }
  }

  async function togglePause(p: PromotionRow) {
    setErr(null);

    setRows((prev) =>
      prev.map((x) =>
        x.id === p.id ? { ...x, status: x.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : x
      )
    );

    try {
      const res = await fetch(`/api/admin/promotions/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: p.status === 'ACTIVE' ? 'pause' : 'resume' })
      });

      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to update status.');
      await load();
    } catch (e) {
      await load();
      setErr(e instanceof Error ? e.message : 'Failed to update status.');
    }
  }

  async function deletePromo(p: PromotionRow) {
    const yes = window.confirm(`Delete promo "${p.code}"? This cannot be undone.`);
    if (!yes) return;

    setErr(null);
    try {
      const res = await fetch(`/api/admin/promotions/${p.id}`, { method: 'DELETE' });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to delete.');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete.');
    }
  }

  async function openEdit(id: string) {
    setEditErr(null);
    setEditId(id);
    setEditLoading(true);
    setEditData(null);

    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { cache: 'no-store' });
      const json = (await res.json()) as {
        ok: boolean;
        promotion?: PromotionDetail;
        error?: string;
      };

      if (!res.ok || !json.ok || !json.promotion) throw new Error(json.error ?? 'Failed to load.');
      setEditData(json.promotion);
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Failed to load.');
      setEditData(null);
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    setEditId(null);
    setEditData(null);
    setEditErr(null);
  }

  async function saveEdit(promo: PromotionDetail, patch: PromotionPatch) {
    setEditErr(null);
    try {
      const res = await fetch(`/api/admin/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to save.');
      closeEdit();
      await load();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Failed to save.');
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div>
          <h1 className={styles.h1}>
            Promotions <span className={styles.count}>{rows.length}</span>
          </h1>
          <p className={styles.sub}>Create promo codes to use in checkout.</p>
        </div>

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => (tab === 'usage' ? loadUsage() : load())}
            disabled={tab === 'usage' ? usageLoading : loading}
          >
            Refresh
          </button>

          {tab === 'promos' && (
            <button type="button" className={styles.primaryBtn} onClick={openModal}>
              + New promo
            </button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'promos' ? styles.tabActive : ''}`}
          onClick={() => setTab('promos')}
        >
          Promotions
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'usage' ? styles.tabActive : ''}`}
          onClick={() => {
            setTab('usage');
            setUsageView('attempts');
            void loadUsage();
          }}
        >
          Usage
        </button>
      </div>

      {tab === 'promos' && (
        <>
          {err && <div className={styles.bannerError}>{err}</div>}

          <div className={styles.card}>
            <div className={styles.filters}>
              <div className={styles.searchWrap}>
                <input
                  className={styles.search}
                  placeholder="Search name/code/target/discount…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <select
                className={styles.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | PromotionStatus)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Discount</th>
                    <th>Type</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Window</th>
                    <th>Target</th>
                    <th>Usage</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={9} className={styles.mutedCell}>
                        Loading…
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className={styles.mutedCell}>
                        No promotions found.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((p) => (
                      <tr key={p.id}>
                        <td className={styles.nameCell}>
                          <div className={styles.nameMain}>{p.name}</div>
                          <div className={styles.nameSub}>
                            Updated {fmtDate(p.updatedAt)} • Created {fmtDate(p.createdAt)}
                          </div>
                        </td>

                        <td>
                          <div className={styles.cellMain}>{discountLabel(p)}</div>
                          {p.applyShippingDiscount && (
                            <div className={styles.cellSub}>
                              + Shipping {p.shippingPercentOffDry ?? 0}% off
                            </div>
                          )}
                        </td>

                        <td>
                          <div className={styles.cellMain}>{p.type}</div>
                          <div className={styles.cellSub}>{p.discountType}</div>
                        </td>

                        <td className={styles.codeCell}>{p.code}</td>

                        <td>
                          <span className={`${styles.pill} ${statusPillClass(p.status)}`}>
                            {p.status}
                          </span>
                        </td>

                        <td>
                          <div className={styles.cellMain}>
                            {p.startsAt ? fmtDate(p.startsAt) : 'Any time'}
                          </div>
                          <div className={styles.cellSub}>
                            {p.endsAt ? fmtDate(p.endsAt) : 'No end'}
                          </div>
                        </td>

                        <td>
                          <div className={styles.cellMain}>{targetLabel(p)}</div>
                        </td>

                        <td>
                          <div className={styles.cellMain}>
                            {p.redemptionCount}
                            {p.maxUsesTotal ? ` / ${p.maxUsesTotal}` : ''}
                          </div>
                          <div className={styles.cellSub}>Redemptions</div>
                        </td>

                        <td className={styles.actionsCell}>
                          <button
                            type="button"
                            className={styles.rowBtn}
                            onClick={() => void openEdit(p.id)}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className={styles.rowBtn}
                            onClick={() => void togglePause(p)}
                            title={p.status === 'ACTIVE' ? 'Pause this promo' : 'Resume this promo'}
                          >
                            {p.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                          </button>

                          <button
                            type="button"
                            className={styles.rowBtnDanger}
                            onClick={() => void deletePromo(p)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create modal */}
          {open && (
            <div className={styles.modalOverlay} role="dialog" aria-modal="true">
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <div>
                    <div className={styles.modalTitle}>New promotion</div>
                    <div className={styles.modalSub}>
                      Choose a promo type and configure the code.
                    </div>
                  </div>

                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={closeModal}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.modalBody} ref={dialogBodyRef}>
                  <div className={styles.kindRow}>
                    <button
                      type="button"
                      className={`${styles.kindCard} ${
                        promoKind === 'AMOUNT_OFF' ? styles.kindActive : ''
                      }`}
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
                      className={`${styles.kindCard} ${
                        promoKind === 'PERCENT_OFF' ? styles.kindActive : ''
                      }`}
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
                      className={`${styles.kindCard} ${
                        promoKind === 'FREE_SHIPPING' ? styles.kindActive : ''
                      }`}
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
                          placeholder="e.g. SUMMERSALE20"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                        />
                        <div className={styles.hint}>
                          Codes are stored uppercase with no spaces.
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Promo name</label>
                        <input
                          className={styles.input}
                          placeholder="e.g. Summer sale"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className={styles.split2}>
                      <div className={styles.field}>
                        <label className={styles.label}>Discount</label>
                        <div
                          className={styles.pillInput}
                          aria-disabled={promoKind === 'FREE_SHIPPING'}
                        >
                          <span className={styles.pillIcon}>
                            {promoKind === 'PERCENT_OFF' ? '%' : '£'}
                          </span>
                          <input
                            className={styles.input}
                            inputMode="numeric"
                            disabled={promoKind === 'FREE_SHIPPING'}
                            placeholder={promoKind === 'PERCENT_OFF' ? 'e.g. 10' : 'e.g. 5'}
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                          />
                        </div>
                        {promoKind === 'FREE_SHIPPING' && (
                          <div className={styles.hint}>
                            Free shipping promos don’t need an item discount.
                          </div>
                        )}
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

                    {/* ✅ Target picker UI */}
                    {(targetType === 'CATEGORIES' || targetType === 'PRODUCTS') && (
                      <div className={styles.cardInset}>
                        {optsErr && <div className={styles.inlineError}>{optsErr}</div>}
                        {optsLoading && (
                          <div className={styles.mutedCell} style={{ padding: 10 }}>
                            Loading categories/products…
                          </div>
                        )}

                        {!optsLoading && targetType === 'CATEGORIES' && (
                          <MultiPicker
                            title="Select categories"
                            placeholder="Search categories…"
                            options={categoryOptions}
                            selectedIds={selectedCategoryIds}
                            onChange={setSelectedCategoryIds}
                          />
                        )}

                        {!optsLoading && targetType === 'PRODUCTS' && (
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
                          style={{
                            opacity: applyShipping || promoKind === 'FREE_SHIPPING' ? 1 : 0.45
                          }}
                        >
                          0–100%. Use 100% for free shipping.
                        </label>

                        <div
                          className={styles.pillInput}
                          style={{
                            opacity: applyShipping || promoKind === 'FREE_SHIPPING' ? 1 : 0.45
                          }}
                        >
                          <span className={styles.pillIcon}>%</span>
                          <input
                            className={styles.input}
                            inputMode="numeric"
                            disabled={!(applyShipping || promoKind === 'FREE_SHIPPING')}
                            value={shippingPct}
                            onChange={(e) => setShippingPct(e.target.value)}
                            placeholder="e.g. 100"
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
                              placeholder="Total uses"
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

                  {err && <div className={styles.inlineError}>{err}</div>}
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={closeModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={createPromo}
                    disabled={saving}
                  >
                    {saving ? 'Creating…' : 'Create promo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit modal (same as before) */}
          {editId && (
            <div className={styles.modalOverlay} role="dialog" aria-modal="true">
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <div>
                    <div className={styles.modalTitle}>Edit promotion</div>
                    <div className={styles.modalSub}>{editData?.code ?? ''}</div>
                  </div>

                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={closeEdit}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <div className={styles.modalBody}>
                  {editLoading && <div className={styles.mutedCell}>Loading…</div>}
                  {editErr && <div className={styles.inlineError}>{editErr}</div>}

                  {!editLoading && editData && (
                    <EditPromoForm
                      promo={editData}
                      onCancel={closeEdit}
                      onSave={(patch) => void saveEdit(editData, patch)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'usage' && (
        <>
          {usageErr && <div className={styles.bannerError}>{usageErr}</div>}

          <div className={styles.usageRow}>
            <div className={styles.usageCard}>
              <div className={styles.usageKpi}>{usageSummary.totalAttempts}</div>
              <div className={styles.usageLabel}>Attempts</div>
            </div>
            <div className={styles.usageCard}>
              <div className={styles.usageKpi}>{usageSummary.applied}</div>
              <div className={styles.usageLabel}>Applied</div>
            </div>
            <div className={styles.usageCard}>
              <div className={styles.usageKpi}>{usageSummary.redeemed}</div>
              <div className={styles.usageLabel}>Redeemed</div>
            </div>
            <div className={styles.usageCard}>
              <div className={styles.usageKpi}>{usageSummary.appliedNotUsedOnPayment}</div>
              <div className={styles.usageLabel}>Applied but not used</div>
            </div>
            <div className={styles.usageCard}>
              <div className={styles.usageKpi}>{usageSummary.rejected}</div>
              <div className={styles.usageLabel}>Rejected</div>
            </div>
          </div>

          <div className={styles.filters} style={{ borderRadius: 18 }}>
            <div className={styles.searchWrap}>
              <div className={styles.hint}>
                Shows last {usageDays} days (max 365). Includes invalid/unused attempts.
              </div>
            </div>

            <input
              className={styles.search}
              style={{ maxWidth: 140 }}
              inputMode="numeric"
              value={usageDays}
              onChange={(e) => setUsageDays(e.target.value)}
              placeholder="Days"
            />

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => void loadUsage()}
              disabled={usageLoading}
            >
              {usageLoading ? 'Loading…' : 'Reload'}
            </button>
          </div>

          <div className={styles.tabs} style={{ marginTop: 10 }}>
            <button
              type="button"
              className={`${styles.tabBtn} ${usageView === 'attempts' ? styles.tabActive : ''}`}
              onClick={() => setUsageView('attempts')}
            >
              Attempts ({attempts.length})
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${usageView === 'redemptions' ? styles.tabActive : ''}`}
              onClick={() => setUsageView('redemptions')}
            >
              Redemptions ({redemptions.length})
            </button>
          </div>

          {usageView === 'attempts' && (
            <div className={styles.card} style={{ marginTop: 12 }}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Code</th>
                      <th>Outcome</th>
                      <th>Customer</th>
                      <th>Order</th>
                      <th>Discount</th>
                      <th>Note</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usageLoading && (
                      <tr>
                        <td colSpan={7} className={styles.mutedCell}>
                          Loading…
                        </td>
                      </tr>
                    )}

                    {!usageLoading && attempts.length === 0 && (
                      <tr>
                        <td colSpan={7} className={styles.mutedCell}>
                          No attempts found.
                        </td>
                      </tr>
                    )}

                    {!usageLoading &&
                      attempts.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <div className={styles.cellMain}>{fmtDateTime(a.createdAt)}</div>
                            <div className={styles.cellSub}>{a.id.slice(0, 8)}…</div>
                          </td>

                          <td className={styles.codeCell}>{a.code}</td>

                          <td>
                            <span
                              className={`${styles.pill} ${
                                a.outcome === 'REJECTED'
                                  ? styles.pillExpired
                                  : a.redeemedOnOrder
                                    ? styles.pillActive
                                    : styles.pillPaused
                              }`}
                            >
                              {usageStatusLabel(a)}
                            </span>
                          </td>

                          <td>
                            <div className={styles.cellMain}>{a.email ?? '—'}</div>
                            <div className={styles.cellSub}>
                              {a.userId ? `User ${a.userId.slice(0, 8)}…` : 'Guest'}
                            </div>
                          </td>

                          <td>
                            <div className={styles.cellMain}>{a.orderDisplayId ?? '—'}</div>
                            <div className={styles.cellSub}>
                              {a.orderPaymentStatus ?? a.orderStatus ?? '—'}
                            </div>
                          </td>

                          <td>
                            <div className={styles.cellMain}>
                              -{penceToGBP(a.discountPence + a.shippingDiscountPence)}
                            </div>
                            <div className={styles.cellSub}>
                              Sub {a.subtotalPence != null ? penceToGBP(a.subtotalPence) : '—'} •
                              Ship {a.shippingPence != null ? penceToGBP(a.shippingPence) : '—'}
                            </div>
                          </td>

                          <td>
                            <div className={styles.cellMain}>{a.promotionName ?? '—'}</div>
                            <div className={styles.cellSub}>
                              {a.errorCode ?? (a.outcome === 'REJECTED' ? 'Invalid/blocked' : '—')}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {usageView === 'redemptions' && (
            <div className={styles.card} style={{ marginTop: 12 }}>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Code</th>
                      <th>Promotion</th>
                      <th>Customer</th>
                      <th>Order</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {usageLoading && (
                      <tr>
                        <td colSpan={6} className={styles.mutedCell}>
                          Loading…
                        </td>
                      </tr>
                    )}

                    {!usageLoading && redemptions.length === 0 && (
                      <tr>
                        <td colSpan={6} className={styles.mutedCell}>
                          No redemptions found.
                        </td>
                      </tr>
                    )}

                    {!usageLoading &&
                      redemptions.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <div className={styles.cellMain}>{fmtDateTime(r.createdAt)}</div>
                            <div className={styles.cellSub}>{r.id.slice(0, 8)}…</div>
                          </td>

                          <td className={styles.codeCell}>{r.code}</td>

                          <td>
                            <div className={styles.cellMain}>{r.promotionName ?? '—'}</div>
                            <div className={styles.cellSub}>{r.promotionId.slice(0, 8)}…</div>
                          </td>

                          <td>
                            <div className={styles.cellMain}>{r.email ?? '—'}</div>
                            <div className={styles.cellSub}>
                              {r.userId ? `User ${r.userId.slice(0, 8)}…` : 'Guest'}
                            </div>
                          </td>

                          <td>
                            <div className={styles.cellMain}>{r.orderDisplayId ?? '—'}</div>
                            <div className={styles.cellSub}>{r.orderId.slice(0, 8)}…</div>
                          </td>

                          <td>
                            <div className={styles.cellMain}>
                              {r.orderPaymentStatus ?? r.orderStatus ?? '—'}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EditPromoForm({
  promo,
  onCancel,
  onSave
}: {
  promo: PromotionDetail;
  onCancel: () => void;
  onSave: (patch: PromotionPatch) => void;
}) {
  const [name, setName] = useState<string>(promo.name ?? '');
  const [status, setStatus] = useState<PromotionStatus>(promo.status ?? 'ACTIVE');

  const [startsAt, setStartsAt] = useState<string>(isoToDateInput(promo.startsAt));
  const [endsAt, setEndsAt] = useState<string>(isoToDateInput(promo.endsAt));
  const [noEnd, setNoEnd] = useState<boolean>(!promo.endsAt);

  return (
    <>
      <div className={styles.formGrid}>
        <div className={styles.split2}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as PromotionStatus)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>
        </div>

        <div className={styles.split2}>
          <div className={styles.field}>
            <label className={styles.label}>Starts</label>
            <input
              className={styles.input}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Ends</label>
            <input
              className={styles.input}
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              disabled={noEnd}
            />
            <label className={styles.checkInline}>
              <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />
              <span>No end date</span>
            </label>
          </div>
        </div>
      </div>

      <div className={styles.modalFooter}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() =>
            onSave({
              name: name.trim(),
              status,
              startsAt: startsAt ? new Date(startsAt).toISOString() : null,
              endsAt: noEnd ? null : endsAt ? new Date(endsAt).toISOString() : null
            })
          }
        >
          Save
        </button>
      </div>
    </>
  );
}
