'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './offers.module.scss';

import CreateOfferModal from '@/components/admin/offers/CreateOfferModal';
import EditOfferModal from '@/components/admin/offers/EditOfferModal';
import OffersTable from '@/components/admin/offers/OffersTable';
import OffersUsagePanel from '@/components/admin/offers/OffersUsagePanel';
import SendOfferEmailModal from '@/components/admin/offers/SendOfferEmailModal';
import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

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

interface BlastRunResponse {
  ok?: boolean;
  done?: boolean;
  sent?: number;
  failed?: number;
  remaining?: number;
  error?: string;
}

interface BlastCreateResponse {
  ok?: boolean;
  blastId?: string;
  recipients?: number;
  run?: BlastRunResponse;
  error?: string;
}

/* -------------------------------------------
   Utils / guards
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
type OfferCreateSubmission = OfferAdminForm & {
  blastEnabled?: boolean;
  blastScope?: 'ALL_CUSTOMERS' | 'SELECTED_USERS';
  blastUserIds?: string[];
};

function hasId(value: unknown): value is OfferRow {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.length > 0;
}

export default function OffersClient() {
  const { toast, confirm } = useAdminUi();
  const [tab, setTab] = useState<'offers' | 'usage'>('offers');

  // "Send email" on an existing offer (also used to retry a failed create-blast)
  const [emailTarget, setEmailTarget] = useState<{ id: string; name: string | null } | null>(null);
  const [emailInitialSubject, setEmailInitialSubject] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OfferStatus>('ALL');

  const [createOpen, setCreateOpen] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

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

  async function createOfferBlast(params: {
    offerId: string;
    scope: 'ALL_CUSTOMERS' | 'SELECTED_USERS';
    userIds: string[];
    subject: string;
    message: string | null;
  }) {
    const res = await fetch(`/api/admin/offers/${params.offerId}/email-blast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope: params.scope,
        userIds: params.userIds,
        subject: params.subject,
        message: params.message
      })
    });

    const json = (await res.json()) as BlastCreateResponse | ApiErr | unknown;

    if (!res.ok) {
      throw new Error(readApiError(json) ?? 'Offer created, but email blast failed.');
    }

    if (!isRecord(json) || json.ok !== true || typeof json.blastId !== 'string') {
      throw new Error('Offer created, but blast response was invalid.');
    }

    if (isRecord(json.run) && json.run.ok === false) {
      throw new Error(
        typeof json.run.error === 'string' ? json.run.error : 'Offer blast run failed.'
      );
    }

    return json as BlastCreateResponse;
  }

  async function createOffer(body: OfferCreateSubmission) {
    setErr(null);

    if (!body?.name?.trim()) {
      setErr('Offer name is required.');
      return;
    }

    let created: OfferRow | null = null;

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

      created = (json as { offer: OfferRow }).offer;
    } catch (e) {
      setErr(fmtErr(e, 'Failed to create offer.'));
      return;
    }

    // Offer exists from here on — close the modal and refresh so a
    // failed email can never lead to a duplicate offer being created.
    setCreateOpen(false);
    toast.success(`Offer "${created.name}" created.`);
    await loadOffers();
    window.setTimeout(() => searchRef.current?.focus(), 0);

    if (body.blastEnabled) {
      const subject = (body.emailSubject ?? '').trim();
      const scope = body.blastScope ?? 'ALL_CUSTOMERS';
      const userIds = scope === 'SELECTED_USERS' ? (body.blastUserIds ?? []) : [];

      try {
        if (!subject) {
          throw new Error('Email subject is required when email-after-create is enabled.');
        }
        await createOfferBlast({
          offerId: created.id,
          scope,
          userIds,
          subject,
          message: body.emailMessage ?? null
        });
        toast.success('Offer email sent.');
      } catch (e) {
        // The offer is fine — open the standalone email modal to retry.
        toast.error(fmtErr(e, 'Offer email failed.'));
        setEmailInitialSubject(subject || null);
        setEmailTarget({ id: created.id, name: created.name ?? null });
      }
    }
  }

  async function toggleOffer(o: OfferRow) {
    setErr(null);

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
    const yes = await confirm({
      title: `Delete offer "${o.name}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true
    });
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
                <option value="ACTIVE">Running</option>
                <option value="PAUSED">Paused</option>
                <option value="EXPIRED">Finished</option>
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
                  onSendEmail={(o) => {
                    setEmailInitialSubject(null);
                    setEmailTarget({ id: o.id, name: o.name ?? null });
                  }}
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

          <SendOfferEmailModal
            open={emailTarget !== null}
            offerId={emailTarget?.id ?? null}
            offerName={emailTarget?.name ?? null}
            initialSubject={emailInitialSubject}
            onClose={() => setEmailTarget(null)}
            onSent={(r) =>
              toast.success(
                typeof r.recipients === 'number'
                  ? `Offer email sent to ${r.recipients} recipient${r.recipients === 1 ? '' : 's'}.`
                  : 'Offer email sent.'
              )
            }
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
