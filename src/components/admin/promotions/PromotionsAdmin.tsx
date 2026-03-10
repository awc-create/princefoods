'use client';

import { useEffect, useMemo, useState } from 'react';

import styles from './promotions.module.scss';

import type {
  ApiErr,
  ApiListOk,
  CreateBody,
  OptionsApiOk,
  PickerOption,
  PromotionDetail,
  PromotionPatch,
  PromotionRow,
  PromotionStatus,
  UsageApiOk,
  UsageAttemptRow,
  UsageRedemptionRow
} from './types';

import CreatePromotionModal from './CreatePromotionModal';
import EditPromotionModal from './EditPromotionModal';
import PromotionsTable from './PromotionsTable';
import UsagePanel from './UsagePanel';
import { discountLabel, targetLabel } from './utils';

type CustomerOptionsResponse =
  | { ok: true; options: PickerOption[] }
  | { ok: true; customers: Array<{ id: string; name: string | null; email: string }> }
  | { ok: false; error: string }
  | { error?: string };

export default function PromotionsAdmin() {
  const [tab, setTab] = useState<'promos' | 'usage'>('promos');

  // promos list
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<PromotionRow[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PromotionStatus>('ALL');

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // category/product picker options
  const [optsLoading, setOptsLoading] = useState(false);
  const [optsErr, setOptsErr] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<PickerOption[]>([]);
  const [productOptions, setProductOptions] = useState<PickerOption[]>([]);

  // customer picker options (separate endpoint)
  const [custLoading, setCustLoading] = useState(false);
  const [custErr, setCustErr] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState<PickerOption[]>([]);

  // edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [editData, setEditData] = useState<PromotionDetail | null>(null);

  // usage
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageErr, setUsageErr] = useState<string | null>(null);
  const [usageDays, setUsageDays] = useState('30');
  const [attempts, setAttempts] = useState<UsageAttemptRow[]>([]);
  const [redemptions, setRedemptions] = useState<UsageRedemptionRow[]>([]);

  async function loadPromos() {
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

  async function loadCategoryProductOptions() {
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

      setCategoryOptions((ok.categories ?? []).map((c) => ({ id: c.id, label: c.name })));

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

  // customers come from /api/admin/options/customers
  async function loadCustomerOptions() {
    setCustErr(null);
    setCustLoading(true);

    try {
      const res = await fetch('/api/admin/options/customers', { cache: 'no-store' });
      const json = (await res.json()) as CustomerOptionsResponse;

      if (!res.ok) {
        const msg =
          ('error' in json && typeof json.error === 'string' ? json.error : undefined) ??
          'Failed to load customers.';
        setCustErr(msg);
        setCustomerOptions([]);
        return;
      }

      // 1) { ok:true, options: PickerOption[] }
      if ('ok' in json && json.ok === true && 'options' in json && Array.isArray(json.options)) {
        setCustomerOptions(json.options);
        return;
      }

      // 2) { ok:true, customers: [...] }
      if (
        'ok' in json &&
        json.ok === true &&
        'customers' in json &&
        Array.isArray(json.customers)
      ) {
        setCustomerOptions(
          json.customers.map((c) => ({
            id: c.id,
            label: c.name?.trim() ? c.name.trim() : c.email,
            meta: c.email
          }))
        );
        return;
      }

      // fallback
      setCustomerOptions([]);
    } catch (e) {
      setCustErr(e instanceof Error ? e.message : 'Failed to load customers.');
      setCustomerOptions([]);
    } finally {
      setCustLoading(false);
    }
  }

  // combined helper - used by create modal
  async function loadAllPickerOptions() {
    await Promise.all([loadCategoryProductOptions(), loadCustomerOptions()]);
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
    void loadPromos();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
      .filter((r) => {
        if (!query) return true;
        const blob = [
          r.name,
          r.code ?? '',
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

  async function createPromo(body: CreateBody) {
    setCreateError(null);
    setCreating(true);

    try {
      const res = await fetch('/api/admin/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = (await res.json()) as
        | { ok: true; promotion: { id: string; code: string | null; name: string } }
        | { ok: false; error?: string };

      if (!res.ok || !json.ok) {
        setCreateError(
          !json.ok ? (json.error ?? 'Failed to create promotion.') : 'Failed to create.'
        );
        throw new Error(!json.ok ? (json.error ?? 'Failed') : 'Failed');
      }

      setCreateOpen(false);
      await loadPromos();

      return {
        id: json.promotion.id,
        code: json.promotion.code ?? null,
        name: json.promotion.name
      };
    } catch (e) {
      // ensure modal sees createError too
      if (!createError)
        setCreateError(e instanceof Error ? e.message : 'Failed to create promotion.');
      throw e;
    } finally {
      setCreating(false);
    }
  }

  async function togglePause(p: PromotionRow) {
    setErr(null);

    // optimistic
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
      await loadPromos();
    } catch (e) {
      await loadPromos();
      setErr(e instanceof Error ? e.message : 'Failed to update status.');
    }
  }

  async function deletePromo(p: PromotionRow) {
    const yes = window.confirm(`Delete promo "${p.code ?? ''}"? This cannot be undone.`);
    if (!yes) return;

    setErr(null);
    try {
      const res = await fetch(`/api/admin/promotions/${p.id}`, { method: 'DELETE' });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to delete.');
      await loadPromos();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete.');
    }
  }

  function openEdit(id: string) {
    setEditErr(null);
    setEditId(id);
    setEditOpen(true);
  }

  async function loadEdit(id: string) {
    setEditLoading(true);
    setEditErr(null);
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
    setEditOpen(false);
    setEditId(null);
    setEditData(null);
    setEditErr(null);
  }

  async function saveEdit(id: string, patch: PromotionPatch) {
    setEditErr(null);
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to save.');
      closeEdit();
      await loadPromos();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Failed to save.');
    }
  }

  // unify picker-loading UI for modals
  const combinedOptionsLoading = optsLoading || custLoading;
  const combinedOptionsError = optsErr ?? custErr;

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
            onClick={() => (tab === 'usage' ? loadUsage() : loadPromos())}
            disabled={tab === 'usage' ? usageLoading : loading}
          >
            Refresh
          </button>

          {tab === 'promos' && (
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
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

            <PromotionsTable
              rows={filtered}
              loading={loading}
              onEdit={openEdit}
              onTogglePause={togglePause}
              onDelete={deletePromo}
            />
          </div>

          <CreatePromotionModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            categoryOptions={categoryOptions}
            productOptions={productOptions}
            optionsLoading={combinedOptionsLoading}
            optionsError={combinedOptionsError}
            onRequestOptions={loadAllPickerOptions}
            onCreate={createPromo}
            creating={creating}
            createError={createError}
          />

          <EditPromotionModal
            id={editId}
            open={editOpen}
            onClose={closeEdit}
            onLoad={(x) => void loadEdit(x)}
            loading={editLoading}
            error={editErr}
            promotion={editData}
            onSave={(pid, patch) => void saveEdit(pid, patch)}
            customerOptions={customerOptions}
            optionsLoading={combinedOptionsLoading}
            optionsError={combinedOptionsError}
            onRequestOptions={loadCustomerOptions}
          />
        </>
      )}

      {tab === 'usage' && (
        <UsagePanel
          loading={usageLoading}
          error={usageErr}
          days={usageDays}
          setDays={setUsageDays}
          onReload={loadUsage}
          attempts={attempts}
          redemptions={redemptions}
        />
      )}
    </div>
  );
}
