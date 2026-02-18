// src/app/admin/offers/offers-client.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './offers.module.scss';

import CreateOfferModal from '@/components/admin/offers/CreateOfferModal';
import EditOfferModal from '@/components/admin/offers/EditOfferModal';
import OffersTable from '@/components/admin/offers/OffersTable';
import OffersUsagePanel from '@/components/admin/offers/OffersUsagePanel';

import type { OfferAdminForm, OfferStatus } from '@/types/offers';

interface ApiErr {
  error: string;
}

interface OfferUsageAttemptRow {
  id: string;
  createdAt: string;

  offerId?: string | null;
  offerName?: string | null;

  outcome: 'APPLIED' | 'REJECTED';
  redeemedOnOrder: boolean;

  email?: string | null;
  userId?: string | null;

  orderId?: string | null;
  orderDisplayId?: string | null;
  orderStatus?: string | null;
  orderPaymentStatus?: string | null;

  discountPence: number;
  shippingDiscountPence: number;

  subtotalPence?: number | null;
  shippingPence?: number | null;

  errorCode?: string | null;
}

interface OfferUsageRedemptionRow {
  id: string;
  createdAt: string;

  offerId: string;
  offerName?: string | null;

  email?: string | null;
  userId?: string | null;

  orderId: string;
  orderDisplayId?: string | null;
  orderStatus?: string | null;
  orderPaymentStatus?: string | null;

  discountPence: number;
  shippingDiscountPence: number;
}

interface OfferUsageApiOk {
  ok: true;
  attempts: OfferUsageAttemptRow[];
  redemptions: OfferUsageRedemptionRow[];
}

/* -------------------------------------------
   Utils / guards (no any, no overload issues)
------------------------------------------- */
function fmtErr(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function readApiError(x: unknown): string | null {
  if (!isRecord(x)) return null;
  return typeof x.error === 'string' ? x.error : null;
}

function isListOk(x: unknown): x is { offers: unknown[] } {
  if (!isRecord(x)) return false;
  return Array.isArray(x.offers);
}

function isOneOk(x: unknown): x is { offer: unknown } {
  if (!isRecord(x)) return false;
  return 'offer' in x && isRecord(x.offer);
}

type OfferRow = OfferAdminForm & { id: string };

/**
 * IMPORTANT: predicate must accept `unknown` so it can be used on `unknown[]`
 * (avoids the TS2769 "No overload matches this call" loop)
 */
function hasId(value: unknown): value is OfferRow {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0;
}

export default function OffersClient() {
  const [tab, setTab] = useState<'offers' | 'usage'>('offers');

  // offers list
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OfferStatus>('ALL');

  // create modal
  const [createOpen, setCreateOpen] = useState(false);

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // usage
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageErr, setUsageErr] = useState<string | null>(null);
  const [usageDays, setUsageDays] = useState('30');
  const [attempts, setAttempts] = useState<OfferUsageAttemptRow[]>([]);
  const [redemptions, setRedemptions] = useState<OfferUsageRedemptionRow[]>([]);

  const searchRef = useRef<HTMLInputElement | null>(null);

  async function loadOffers() {
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/offers', { cache: 'no-store' });
      const json = (await res.json()) as unknown;

      if (!res.ok || !isListOk(json)) {
        setRows([]);
        setErr(readApiError(json) ?? 'Failed to load offers.');
        return;
      }

      // json.offers is unknown[] here, so filter predicate must accept unknown
      const list = (json.offers ?? []).filter(hasId);
      setRows(list);
    } catch (e) {
      setRows([]);
      setErr(fmtErr(e, 'Failed to load offers.'));
    } finally {
      setLoading(false);
    }
  }

  async function loadUsage() {
    setUsageErr(null);
    setUsageLoading(true);

    try {
      const days = Math.max(1, Math.min(365, Number(usageDays || '30')));
      const res = await fetch(`/api/admin/offers/usage?days=${days}`, { cache: 'no-store' });
      const json = (await res.json()) as OfferUsageApiOk | ApiErr;

      if (!res.ok || !('ok' in json) || (json as OfferUsageApiOk).ok !== true) {
        setUsageErr('error' in json && json.error ? json.error : 'Failed to load usage.');
        setAttempts([]);
        setRedemptions([]);
        return;
      }

      const ok = json as OfferUsageApiOk;
      setAttempts(ok.attempts ?? []);
      setRedemptions(ok.redemptions ?? []);
    } catch (e) {
      setUsageErr(fmtErr(e, 'Failed to load usage.'));
      setAttempts([]);
      setRedemptions([]);
    } finally {
      setUsageLoading(false);
    }
  }

  useEffect(() => {
    void loadOffers();
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows
      .filter((r) => (statusFilter === 'ALL' ? true : r.status === statusFilter))
      .filter((r) => {
        if (!query) return true;

        const blob = [
          r.name,
          r.status,
          r.mode,
          r.code ?? '',
          r.payload?.kind ?? '',
          String(r.priority ?? 0)
        ]
          .join(' ')
          .toLowerCase();

        return blob.includes(query);
      });
  }, [rows, q, statusFilter]);

  async function createOffer(body: OfferAdminForm) {
    setErr(null);

    if (!body?.name?.trim()) {
      setErr('Offer name is required.');
      return;
    }

    try {
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const json = (await res.json()) as unknown;

      if (!res.ok || !isOneOk(json) || !hasId((json as { offer?: unknown }).offer)) {
        setErr(readApiError(json) ?? 'Failed to create offer.');
        return;
      }

      setCreateOpen(false);
      await loadOffers();
      window.setTimeout(() => searchRef.current?.focus(), 0);
    } catch (e) {
      setErr(fmtErr(e, 'Failed to create offer.'));
    }
  }

  async function toggleOffer(o: OfferRow) {
    setErr(null);

    // optimistic
    setRows((prev) =>
      prev.map((x) =>
        x.id === o.id ? { ...x, status: x.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : x
      )
    );

    try {
      const nextStatus: OfferStatus = o.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';

      const res = await fetch(`/api/admin/offers/${o.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...o, status: nextStatus })
      });

      const json = (await res.json()) as unknown;

      if (!res.ok || !isOneOk(json)) {
        throw new Error(readApiError(json) ?? 'Failed to update offer.');
      }

      await loadOffers();
    } catch (e) {
      await loadOffers();
      setErr(fmtErr(e, 'Failed to update offer.'));
    }
  }

  async function deleteOffer(o: OfferRow) {
    const yes = window.confirm(`Delete offer "${o.name}"? This cannot be undone.`);
    if (!yes) return;

    setErr(null);

    try {
      const res = await fetch(`/api/admin/offers/${o.id}`, { method: 'DELETE' });
      const json = (await res.json()) as unknown;

      const ok = isRecord(json) && typeof json.ok === 'boolean' ? json.ok : false;

      if (!res.ok || !ok) {
        setErr(readApiError(json) ?? 'Failed to delete offer.');
        return;
      }

      await loadOffers();
    } catch (e) {
      setErr(fmtErr(e, 'Failed to delete offer.'));
    }
  }

  function openCreate() {
    setErr(null);
    setCreateOpen(true);
  }

  function openEdit(id: string) {
    setErr(null);
    setEditId(id);
    setEditOpen(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <div>
          <h1 className={styles.h1}>
            Offers <span className={styles.count}>{rows.length}</span>
          </h1>
          <p className={styles.sub}>
            Automatic deals like BOGOF / X-for-Y / X-for-£ (no coupon code needed).
          </p>
        </div>

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => void (tab === 'usage' ? loadUsage() : loadOffers())}
            disabled={tab === 'usage' ? usageLoading : loading}
          >
            Refresh
          </button>

          {tab === 'offers' && (
            <button type="button" className={styles.primaryBtn} onClick={openCreate}>
              + New offer
            </button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${tab === 'offers' ? styles.tabActive : ''}`}
          onClick={() => setTab('offers')}
        >
          Offers
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

      {tab === 'offers' && (
        <>
          {err && <div className={styles.bannerError}>{err}</div>}

          <div className={styles.card}>
            <div className={styles.filters}>
              <div className={styles.searchWrap}>
                <input
                  ref={searchRef}
                  className={styles.search}
                  placeholder="Search name/kind/status…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <select
                className={styles.select}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | OfferStatus)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            <div className={styles.tableWrap}>
              {loading ? (
                <div className={styles.mutedCell}>Loading…</div>
              ) : filtered.length === 0 ? (
                <div className={styles.mutedCell}>No offers found.</div>
              ) : (
                <OffersTable
                  rows={filtered}
                  onEdit={(id) => openEdit(id)}
                  onToggle={(o) => void toggleOffer(o)}
                  onDelete={(o) => void deleteOffer(o)}
                />
              )}
            </div>
          </div>

          <CreateOfferModal
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreate={createOffer}
          />

          <EditOfferModal
            open={editOpen}
            offerId={editId}
            onClose={() => {
              setEditOpen(false);
              setEditId(null);
            }}
            onSaved={loadOffers}
          />
        </>
      )}

      {tab === 'usage' && (
        <OffersUsagePanel
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
