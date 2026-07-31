// src/components/admin/customer-discounts/CustomerDiscountsAdmin.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './customer-discounts.module.scss';

import type {
  ApiErr,
  CreateBody,
  CustomerDiscountRow,
  DiscountStatus,
  ListOk,
  PatchBody,
  PickerOption
} from './types';

import CreateCustomerDiscountModal from './CreateCustomerDiscountModal';
import CustomerDiscountsTable from './CustomerDiscountsTable';
import EditCustomerDiscountModal from './EditCustomerDiscountModal';

interface CustomerOptionsOk {
  options: PickerOption[];
}
interface CustomerOptionsErr {
  error?: string;
}

function isCustomerOptionsOk(v: unknown): v is CustomerOptionsOk {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  if (!Array.isArray(obj.options)) return false;

  // shallow validate shape enough for UI safety
  return (obj.options as unknown[]).every((o) => {
    if (!o || typeof o !== 'object') return false;
    const r = o as Record<string, unknown>;
    return typeof r.id === 'string' && typeof r.label === 'string';
  });
}

export default function CustomerDiscountsAdmin() {
  const [loading, setLoading] = useState(true);
  const { confirm } = useAdminUi();
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<CustomerDiscountRow[]>([]);

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DiscountStatus>('ALL');

  // customers options (picker)
  const [custLoading, setCustLoading] = useState(false);
  const [custErr, setCustErr] = useState<string | null>(null);
  const [customerOptions, setCustomerOptions] = useState<PickerOption[]>([]);

  // create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const selectedRow = useMemo(
    () => (editId ? (rows.find((r) => r.id === editId) ?? null) : null),
    [editId, rows]
  );

  async function loadRows() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/customer-discounts', { cache: 'no-store' });
      const json = (await res.json()) as ListOk | ApiErr;

      if (!res.ok || !json.ok) {
        setErr((json as ApiErr).error ?? 'Failed to load customer discounts.');
        setRows([]);
        return;
      }

      setRows((json as ListOk).rows ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load customer discounts.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // ✅ stable + race-safe loader for remote picker
  const optsAbortRef = useRef<AbortController | null>(null);
  const lastReqIdRef = useRef(0);

  const loadCustomerOptions = useCallback(async (search = '') => {
    const reqId = ++lastReqIdRef.current;

    // cancel previous request
    optsAbortRef.current?.abort();
    const controller = new AbortController();
    optsAbortRef.current = controller;

    setCustErr(null);
    setCustLoading(true);

    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('q', search.trim());
      qs.set('take', '200');

      const res = await fetch(`/api/admin/options/customers?${qs.toString()}`, {
        cache: 'no-store',
        signal: controller.signal
      });

      const jsonUnknown: unknown = await res.json().catch(() => ({}));

      // ignore out-of-order response
      if (reqId !== lastReqIdRef.current) return;

      if (!res.ok) {
        const errVal =
          typeof (jsonUnknown as CustomerOptionsErr)?.error === 'string'
            ? (jsonUnknown as CustomerOptionsErr).error
            : null;

        setCustErr(errVal ?? 'Failed to load customers.');
        setCustomerOptions([]);
        return;
      }

      if (!isCustomerOptionsOk(jsonUnknown)) {
        setCustErr('Invalid response from customers options API.');
        setCustomerOptions([]);
        return;
      }

      setCustomerOptions(jsonUnknown.options);
    } catch (e) {
      // ignore abort errors
      if (e instanceof DOMException && e.name === 'AbortError') return;

      // ignore out-of-order
      if (reqId !== lastReqIdRef.current) return;

      setCustErr(e instanceof Error ? e.message : 'Failed to load customers.');
      setCustomerOptions([]);
    } finally {
      // only settle loading for latest request
      if (reqId === lastReqIdRef.current) setCustLoading(false);
    }
  }, []);

  async function createDiscount(body: CreateBody) {
    setCreateError(null);
    setCreating(true);

    try {
      const res = await fetch('/api/admin/customer-discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setCreateError(json.error ?? 'Failed to create.');
        return;
      }

      setCreateOpen(false);
      await loadRows();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create.');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(id: string) {
    setEditErr(null);
    setEditId(id);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditId(null);
    setEditErr(null);
  }

  async function saveEdit(id: string, patch: PatchBody) {
    setEditErr(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/customer-discounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to save.');

      closeEdit();
      await loadRows();
    } catch (e) {
      setEditErr(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function stopNow(id: string) {
    setErr(null);
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const iso = new Date(`${yyyy}-${mm}-${dd}`).toISOString();

      const res = await fetch(`/api/admin/customer-discounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endsAt: iso })
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to stop.');

      await loadRows();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to stop.');
    }
  }

  async function deleteRow(id: string) {
    const yes = await confirm({
      title: 'Delete this customer discount record?',
      message: 'This removes it from history.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!yes) return;

    setErr(null);
    try {
      const res = await fetch(`/api/admin/customer-discounts/${id}`, { method: 'DELETE' });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? 'Failed to delete.');

      await loadRows();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete.');
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows
      .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
      .filter((r) => {
        if (!query) return true;
        const blob = [r.userLabel, r.userEmail, String(r.percentOff), r.note ?? '', r.status]
          .join(' ')
          .toLowerCase();
        return blob.includes(query);
      });
  }, [rows, q, statusFilter]);

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div>
          <h1 className={styles.h1}>
            Customer Discounts <span className={styles.count}>{rows.length}</span>
          </h1>
          <p className={styles.sub}>Customer-only discounts (keeps history + audit trail).</p>
        </div>

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={loadRows}
            disabled={loading}
          >
            Refresh
          </button>

          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => {
              setCreateError(null);
              setCreateOpen(true);
              void loadCustomerOptions('');
            }}
          >
            + New customer discount
          </button>
        </div>
      </div>

      {err && <div className={styles.bannerError}>{err}</div>}

      <div className={styles.card}>
        <div className={styles.filters}>
          <div className={styles.searchWrap}>
            <input
              className={styles.search}
              placeholder="Search customer/email/note…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | DiscountStatus)}
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>

        <CustomerDiscountsTable
          rows={filtered}
          loading={loading}
          onEdit={openEdit}
          onStopNow={stopNow}
          onDelete={deleteRow}
        />
      </div>

      <CreateCustomerDiscountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        customerOptions={customerOptions}
        optionsLoading={custLoading}
        optionsError={custErr}
        onRequestOptions={loadCustomerOptions}
        onCreate={createDiscount}
        creating={creating}
        createError={createError}
      />

      <EditCustomerDiscountModal
        open={editOpen}
        onClose={closeEdit}
        row={selectedRow}
        onSave={saveEdit}
        saving={saving}
        error={editErr}
      />
    </div>
  );
}
