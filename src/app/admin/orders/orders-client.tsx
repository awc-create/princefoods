// src/app/admin/orders/orders-client.tsx
'use client';

import { orderStatusShortLabel, paymentStatusLabel } from '@/lib/admin-labels';

import BuyApcLabelButton from '@/components/admin/orders/BuyApcLabelButton';
import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';
import Badge, { orderStatusTone, paymentStatusTone } from '@/components/admin/ui/Badge';
import EmptyState from '@/components/admin/ui/EmptyState';
import useDebouncedValue from '@/components/admin/ui/useDebouncedValue';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

type OrderStatus = 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'FAILED';

interface ListItem {
  id: string;
  displayId?: string | null;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  contactEmail: string;
  grandTotal: number;
  items: number;
  paymentProvider: string | null;
  totalWeightGrams?: number | null;
  archivedAt?: string | null;
}

interface ListResponse {
  ok: true;
  meta: { page: number; limit: number; total: number; pageCount: number };
  items: ListItem[];
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok || (data && data.ok === false)) {
    throw new Error(data?.error ?? res.statusText);
  }
  return data as T;
}

/* ---------------- main ---------------- */
export default function OrdersClient() {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/orders';
  const spRaw = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(spRaw?.toString() ?? ''), [spRaw]);
  const { toast, confirm } = useAdminUi();

  // URL is the source of truth for filters
  const status = sp.get('status') ?? '';
  const paymentStatus = sp.get('payment') ?? '';
  const provider = sp.get('provider') ?? 'all';
  const archived = sp.get('archived') ?? 'active';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const urlQ = sp.get('q') ?? '';

  // Search input is local so typing stays responsive; debounced into the URL.
  const [qInput, setQInput] = useState(urlQ);
  const debouncedQ = useDebouncedValue(qInput, 300);

  const setParams = useCallback(
    (updates: Record<string, string>, resetPage = true) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (resetPage) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname]
  );

  useEffect(() => {
    if (debouncedQ !== urlQ) setParams({ q: debouncedQ });
  }, [debouncedQ, urlQ, setParams]);

  const [rows, setRows] = useState<ListItem[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // bulk selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const selectedIds = useMemo(
    () => rows.filter((r) => selected[r.id]).map((r) => r.id),
    [rows, selected]
  );
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected[r.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadErr(null);
      try {
        const params = new URLSearchParams();
        if (urlQ) params.set('q', urlQ);
        if (status) params.set('status', status);
        if (paymentStatus) params.set('paymentStatus', paymentStatus);
        if (provider) params.set('provider', provider);
        if (archived) params.set('archived', archived);
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        params.set('page', String(page));
        params.set('limit', '25');

        const res = await fetch(`/api/admin/orders?${params}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => null)) as ListResponse | { ok: false } | null;
        if (cancelled) return;

        if (res.ok && data && 'ok' in data && data.ok) {
          setRows(data.items);
          setMeta(data.meta);
          setSelected({});
        } else {
          setRows([]);
          setMeta(null);
          setLoadErr(`Failed to load orders (${res.status})`);
        }
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setMeta(null);
          setLoadErr(e instanceof Error ? e.message : 'Failed to load orders.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [urlQ, status, paymentStatus, provider, archived, from, to, page, refreshKey]);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
      (pence ?? 0) / 100
    );
  const formatKg = (g?: number | null) => (g ? `${(g / 1000).toFixed(2)} kg` : '—');

  const hasFilters = Boolean(urlQ || status || paymentStatus || from || to) ||
    provider !== 'all' ||
    archived !== 'active';

  const clearFilters = () => {
    setQInput('');
    router.replace(pathname, { scroll: false });
  };

  async function bulkArchive(unarchive: boolean) {
    const verb = unarchive ? 'Unarchive' : 'Archive';
    const ok = await confirm({
      title: `${verb} ${selectedIds.length} order${selectedIds.length === 1 ? '' : 's'}?`,
      message: unarchive
        ? 'They will reappear in the active orders list.'
        : 'Archived orders stay searchable via the Archived filter.',
      confirmLabel: verb
    });
    if (!ok) return;

    setBulkBusy(true);
    let done = 0;
    let failed = 0;
    for (const id of selectedIds) {
      try {
        await postJson(`/api/admin/orders/${id}/${unarchive ? 'unarchive' : 'archive'}`);
        done++;
      } catch {
        failed++;
      }
    }
    setBulkBusy(false);
    if (failed) toast.error(`${verb}d ${done}, failed ${failed}.`);
    else toast.success(`${verb}d ${done} order${done === 1 ? '' : 's'}.`);
    refresh();
  }

  const badge = (prov: string | null) => {
    if (prov === 'test' || prov === 'stripe_test') return <Badge tone="muted">Test</Badge>;
    if (prov === 'stripe' || prov === 'stripe_live') return <Badge tone="info">Stripe</Badge>;
    return null;
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ marginBottom: 16 }}>
          Orders{' '}
          {meta && (
            <span style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>
              {meta.total.toLocaleString('en-GB')} {hasFilters ? 'matching' : 'total'}
            </span>
          )}
        </h1>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link href="/admin/orders/exceptions" style={topBtn}>
            Exceptions / Returns →
          </Link>
          <button type="button" onClick={refresh} style={{ ...topBtn, cursor: 'pointer' }}>
            Refresh
          </button>
        </div>
      </div>

      <p style={{ margin: '-8px 0 16px', color: '#6b7280', fontSize: 13.5 }}>
        Every order customers have placed. Open one to see what to pack and what to do next.
      </p>

      {/* filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 16,
          alignItems: 'center'
        }}
      >
        <input
          placeholder="Search by name, email, or order no."
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          style={{ padding: '6px 8px', minWidth: 260 }}
        />

        <label>
          Status:&nbsp;
          <select value={status} onChange={(e) => setParams({ status: e.target.value })}>
            <option value="">All</option>
            <option value="PAID">Paid — ready to pack</option>
            <option value="FULFILLED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>

        <label>
          Payment:&nbsp;
          <select
            value={paymentStatus}
            onChange={(e) => setParams({ payment: e.target.value })}
          >
            <option value="">All</option>
            <option value="CAPTURED">Paid</option>
            <option value="PENDING">Not paid yet</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Payment failed</option>
          </select>
        </label>

        <label>
          Provider:&nbsp;
          <select value={provider} onChange={(e) => setParams({ provider: e.target.value })}>
            <option value="all">All</option>
            <option value="stripe">Stripe (hide tests)</option>
            <option value="test">Test only</option>
          </select>
        </label>

        <label>
          Archived:&nbsp;
          <select value={archived} onChange={(e) => setParams({ archived: e.target.value })}>
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
          </select>
        </label>

        <label>
          From:&nbsp;
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setParams({ from: e.target.value })}
          />
        </label>

        <label>
          To:&nbsp;
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setParams({ to: e.target.value })}
          />
        </label>

        {hasFilters && (
          <button type="button" onClick={clearFilters} style={{ ...topBtn, cursor: 'pointer' }}>
            Clear filters
          </button>
        )}
      </div>

      {/* bulk bar */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid #c9dcff',
            background: '#eff6ff',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkArchive(false)}
            style={{ ...topBtn, cursor: 'pointer' }}
          >
            {bulkBusy ? 'Working…' : 'Archive'}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => bulkArchive(true)}
            style={{ ...topBtn, cursor: 'pointer' }}
          >
            {bulkBusy ? 'Working…' : 'Unarchive'}
          </button>
          <button
            type="button"
            onClick={() => setSelected({})}
            style={{ ...topBtn, border: 'none', cursor: 'pointer', background: 'transparent' }}
          >
            Clear selection
          </button>
        </div>
      )}

      {loadErr && (
        <div
          style={{
            padding: '10px 14px',
            marginBottom: 12,
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            fontWeight: 600
          }}
        >
          {loadErr}{' '}
          <button type="button" onClick={refresh} style={{ ...topBtn, cursor: 'pointer' }}>
            Retry
          </button>
        </div>
      )}

      {/* table */}
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 && !loadErr ? (
        <EmptyState
          title="No orders found"
          hint={hasFilters ? 'Try widening or clearing your filters.' : 'New orders appear here.'}
          action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
        />
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 34 }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={(e) => {
                        const on = e.target.checked;
                        const next: Record<string, boolean> = {};
                        if (on) for (const r of rows) next[r.id] = true;
                        setSelected(next);
                      }}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th style={th}>Order</th>
                  <th style={th}>Customer</th>
                  <th style={th}>Items</th>
                  <th style={th}>Weight</th>
                  <th style={th}>Status</th>
                  <th style={th}>Payment</th>
                  <th style={th}>Total</th>
                  <th style={th}>Placed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr
                    key={order.id}
                    style={{
                      borderTop: '1px solid #e5e7eb',
                      opacity: order.archivedAt ? 0.72 : 1
                    }}
                  >
                    <td style={td}>
                      <input
                        type="checkbox"
                        checked={!!selected[order.id]}
                        onChange={(e) =>
                          setSelected((s) => ({ ...s, [order.id]: e.target.checked }))
                        }
                        aria-label={`Select order ${order.displayId ?? order.id}`}
                      />
                    </td>
                    <td style={td}>
                      <Link
                        href={`/admin/orders/${order.id}`}
                        style={{ color: '#007bff', textDecoration: 'none' }}
                      >
                        {order.displayId ?? order.id}
                      </Link>{' '}
                      {badge(order.paymentProvider)}
                      {order.archivedAt && (
                        <span style={{ marginLeft: 6 }}>
                          <Badge tone="muted" title="Archived order">
                            Archived
                          </Badge>
                        </span>
                      )}
                    </td>
                    <td style={td}>{order.contactEmail}</td>
                    <td style={td}>{order.items}</td>
                    <td style={td}>{formatKg(order.totalWeightGrams)}</td>
                    <td style={td}>
                      <Badge tone={orderStatusTone(order.status)}>{orderStatusShortLabel(order.status)}</Badge>
                    </td>
                    <td style={td}>
                      <Badge tone={paymentStatusTone(order.paymentStatus)}>
                        {paymentStatusLabel(order.paymentStatus)}
                      </Badge>
                    </td>
                    <td style={td}>{formatGBP(order.grandTotal)}</td>
                    <td style={td}>
                      {new Date(order.createdAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                      })}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <MiniActionsMenu order={order} onDone={refresh} />
                      <span style={{ marginLeft: 8 }}>
                        <Link
                          href={`/admin/orders/${order.id}#returns`}
                          style={returnsBtn}
                          title="Open returns section"
                        >
                          ↩ Returns
                        </Link>
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        <BuyApcLabelButton
                          mode="live"
                          orderId={order.id}
                          weightGrams={order.totalWeightGrams ?? undefined}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.pageCount > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParams({ page: String(page - 1) }, false)}
              >
                Prev
              </button>
              <div style={{ padding: '6px 10px' }}>
                Page {meta.page} / {meta.pageCount}
              </div>
              <button
                type="button"
                disabled={page >= meta.pageCount}
                onClick={() => setParams({ page: String(page + 1) }, false)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- mini menu ---------------- */
function MiniActionsMenu({ order, onDone }: { order: ListItem; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const { toast, confirm, prompt } = useAdminUi();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function run(path: string, body: unknown, successMsg: string) {
    try {
      await postJson(`/api/admin/orders/${order.id}/${path}`, body);
      toast.success(successMsg);
      onDone?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.');
    }
    setOpen(false);
  }

  const isArchived = !!order.archivedAt;
  const isCancelled = order.status === 'CANCELLED';
  const label = order.displayId ?? order.id;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        title="More actions"
        style={{
          border: '1px solid #ddd',
          borderRadius: 6,
          padding: '2px 8px',
          background: '#fff',
          cursor: 'pointer',
          font: 'inherit',
          lineHeight: 1
        }}
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Order actions"
          style={{
            position: 'absolute',
            right: 0,
            top: '110%',
            background: '#fff',
            color: '#111',
            border: '1px solid #ddd',
            borderRadius: 8,
            minWidth: 220,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 20,
            padding: 6
          }}
        >
          <Link style={menuItemLink} href={`/admin/orders/${order.id}`}>
            View order
          </Link>

          <div style={menuGroupTitle}>Print</div>
          <a
            style={menuItemLink}
            href={`/api/admin/orders/${order.id}/print-order`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Order (picker)
          </a>
          <a
            style={menuItemLink}
            href={`/api/admin/orders/${order.id}/invoice`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Invoice / receipt
          </a>
          <a
            style={menuItemLink}
            href={`/api/admin/orders/${order.id}/packing-slip?v=plain`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Packing slip
          </a>
          <a
            style={menuItemLink}
            href={`/api/admin/orders/${order.id}/packing-slip?v=weights`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Packing slip (weights)
          </a>

          <hr style={{ borderColor: '#eee', margin: '6px 0' }} />

          {!isCancelled && (
            <button
              type="button"
              style={{ ...menuItem, color: '#b00020' }}
              onClick={async () => {
                const reason = await prompt({
                  title: `Cancel order ${label}?`,
                  message: 'The customer will not be charged further. You can add a reason below.',
                  placeholder: 'Reason (optional)',
                  confirmLabel: 'Cancel order',
                  cancelLabel: 'Keep order',
                  danger: true
                });
                if (reason === null) return;
                startTransition(() => {
                  void run(
                    'cancel',
                    { reason: reason.trim() || 'Cancelled from list view' },
                    `Order ${label} cancelled.`
                  );
                });
              }}
            >
              Cancel
            </button>
          )}

          {isCancelled && (
            <button
              type="button"
              style={menuItem}
              onClick={async () => {
                const ok = await confirm({
                  title: `Revert cancellation of ${label}?`,
                  confirmLabel: 'Revert'
                });
                if (!ok) return;
                startTransition(() => {
                  void run('revert-cancel', undefined, `Cancellation reverted for ${label}.`);
                });
              }}
            >
              Revert cancellation
            </button>
          )}

          {!isArchived && (
            <button
              type="button"
              style={menuItem}
              onClick={async () => {
                const ok = await confirm({
                  title: `Archive order ${label}?`,
                  message: 'Archived orders stay searchable via the Archived filter.',
                  confirmLabel: 'Archive'
                });
                if (!ok) return;
                startTransition(() => {
                  void run('archive', undefined, `Order ${label} archived.`);
                });
              }}
            >
              Archive
            </button>
          )}

          {isArchived && (
            <button
              type="button"
              style={menuItem}
              onClick={async () => {
                const ok = await confirm({
                  title: `Unarchive order ${label}?`,
                  confirmLabel: 'Unarchive'
                });
                if (!ok) return;
                startTransition(() => {
                  void run('unarchive', undefined, `Order ${label} unarchived.`);
                });
              }}
            >
              Unarchive
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- styles ---------------- */
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid #d1d5db',
  whiteSpace: 'nowrap'
};

const td: React.CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
};

const topBtn: React.CSSProperties = {
  height: 34,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
  textDecoration: 'none',
  color: '#111',
  fontWeight: 700,
  fontSize: 13
};

const returnsBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 32,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid #ddd',
  background: '#fff',
  color: '#111',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 12
};

const menuItem: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  fontSize: 13
};

const menuItemLink: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 10px',
  textDecoration: 'none',
  color: '#111',
  fontSize: 13
};

const menuGroupTitle: React.CSSProperties = {
  padding: '6px 10px 2px',
  fontSize: 12,
  color: '#666',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.02em'
};
