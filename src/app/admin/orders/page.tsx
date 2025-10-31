'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';

type OrderStatus = 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'FAILED';
type ProviderFilter = 'all' | 'stripe' | 'test';
type ArchivedFilter = 'all' | 'active' | 'archived';

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

/* ---------------- helpers ---------------- */
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

/* ---------------- main page ---------------- */
export default function OrdersPage() {
  const [rows, setRows] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [provider, setProvider] = useState<ProviderFilter>('all'); // show all by default
  const [archived, setArchived] = useState<ArchivedFilter>('active');

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (provider) params.set('provider', provider);
      if (archived) params.set('archived', archived);
      params.set('page', String(page));
      params.set('limit', '25');

      const res = await fetch(`/api/admin/orders?${params}`, { cache: 'no-store' });
      const data = (await res.json()) as ListResponse | { ok: false };
      if ('ok' in data && data.ok) {
        setRows(data.items);
        setMeta(data.meta);
      } else {
        setRows([]);
        setMeta(null);
      }
      setLoading(false);
    }
    load();
  }, [q, status, paymentStatus, provider, archived, page, refreshKey]);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
      (pence ?? 0) / 100
    );
  const formatKg = (g?: number | null) => (g ? `${(g / 1000).toFixed(2)} kg` : '—');

  const badge = (prov: string | null) => {
    if (prov === 'test') {
      return <span style={pill({ bg: '#333', fg: '#fff' })}>Test</span>;
    }
    if (prov === 'stripe') {
      return <span style={pill({ bg: '#e6f0ff', fg: '#2255cc', border: '#c9dcff' })}>Stripe</span>;
    }
    return null;
  };

  const archivedPill = (
    <span title="Archived order" style={pill({ bg: '#f3f4f6', fg: '#6b7280', border: '#e5e7eb' })}>
      Archived
    </span>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Orders</h1>

      {/* filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          placeholder="Search by name, email, or order no."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          style={{ padding: '6px 8px', minWidth: 260 }}
        />

        <label>
          Status:&nbsp;
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="PAID">Paid</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
            <option value="DRAFT">Draft</option>
          </select>
        </label>

        <label>
          Payment:&nbsp;
          <select
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="CAPTURED">Captured</option>
            <option value="PENDING">Pending</option>
            <option value="REFUNDED">Refunded</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>

        <label>
          Provider:&nbsp;
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as ProviderFilter);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="stripe">Stripe (hide tests)</option>
            <option value="test">Test only</option>
          </select>
        </label>

        <label>
          Archived:&nbsp;
          <select
            value={archived}
            onChange={(e) => {
              setArchived(e.target.value as ArchivedFilter);
              setPage(1);
            }}
          >
            <option value="all">All</option>
            <option value="active">Active only</option>
            <option value="archived">Archived only</option>
          </select>
        </label>
      </div>

      {/* table */}
      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1180 }}>
            <thead>
              <tr>
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
                    borderTop: '1px solid #333',
                    opacity: order.archivedAt ? 0.72 : 1
                  }}
                >
                  <td style={td}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      style={{ color: '#007bff', textDecoration: 'none' }}
                    >
                      {order.displayId ?? order.id}
                    </Link>
                    {badge(order.paymentProvider)}
                    {order.archivedAt && <span style={{ marginLeft: 8 }}>{archivedPill}</span>}
                  </td>
                  <td style={td}>{order.contactEmail}</td>
                  <td style={td}>{order.items}</td>
                  <td style={td}>{formatKg(order.totalWeightGrams)}</td>
                  <td style={td}>{order.status}</td>
                  <td style={td}>{order.paymentStatus}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {meta && meta.pageCount > 1 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Prev
              </button>
              <div style={{ padding: '6px 10px' }}>
                Page {meta.page} / {meta.pageCount}
              </div>
              <button
                type="button"
                disabled={page >= meta.pageCount}
                onClick={() => setPage((p) => p + 1)}
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

  async function doPost(path: string, body?: unknown) {
    await postJson(`/api/admin/orders/${order.id}/${path}`, body);
    onDone?.();
    setOpen(false);
  }

  function confirmAndRun(message: string, run: () => void) {
    if (window.confirm(message)) {
      startTransition(run);
    }
  }

  const isArchived = !!order.archivedAt;
  const isCancelled = order.status === 'CANCELLED';

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
          <button
            type="button"
            style={menuItem}
            onClick={() =>
              window.open(`/admin/orders/${order.id}`, '_blank', 'noopener,noreferrer')
            }
          >
            View order
          </button>

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
              onClick={() =>
                confirmAndRun('Are you sure you want to cancel this order?', () =>
                  doPost('cancel', { reason: 'Cancelled from list view' })
                )
              }
            >
              Cancel
            </button>
          )}

          {isCancelled && (
            <button
              type="button"
              style={menuItem}
              onClick={() =>
                confirmAndRun('Revert this cancellation?', () => doPost('revert-cancel'))
              }
            >
              Revert cancellation
            </button>
          )}

          {!isArchived && (
            <button
              type="button"
              style={menuItem}
              onClick={() =>
                confirmAndRun('Are you sure you want to archive this order?', () =>
                  doPost('archive')
                )
              }
            >
              Archive
            </button>
          )}

          {isArchived && (
            <button
              type="button"
              style={menuItem}
              onClick={() => confirmAndRun('Unarchive this order?', () => doPost('unarchive'))}
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
  borderBottom: '1px solid #333',
  whiteSpace: 'nowrap'
};

const td: React.CSSProperties = {
  padding: '8px 10px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
};

function pill({
  bg,
  fg,
  border
}: {
  bg: string;
  fg: string;
  border?: string;
}): React.CSSProperties {
  return {
    marginLeft: 8,
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 999,
    background: bg,
    color: fg,
    border: border ? `1px solid ${border}` : undefined,
    display: 'inline-block',
    lineHeight: 1.4
  };
}

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
