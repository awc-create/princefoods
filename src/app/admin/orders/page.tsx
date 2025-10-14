'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type OrderStatus = 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'FAILED';
type ProviderFilter = 'all' | 'stripe' | 'test';

interface ListItem {
  id: string;
  displayId?: string | null;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  contactEmail: string;
  grandTotal: number; // pence
  items: number;
  paymentProvider: string | null; // 'stripe' | 'test' | null
  totalWeightGrams?: number | null;
}

interface ListResponse {
  ok: true;
  meta: { page: number; limit: number; total: number; pageCount: number };
  items: ListItem[];
}

export default function OrdersPage() {
  const [rows, setRows] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<string>('');
  const [provider, setProvider] = useState<ProviderFilter>('stripe'); // 👈 hide tests by default

  // pagination
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (status) params.set('status', status);
      if (paymentStatus) params.set('paymentStatus', paymentStatus);
      if (provider) params.set('provider', provider);
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
  }, [q, status, paymentStatus, provider, page]);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
      (pence ?? 0) / 100
    );

  const formatKg = (g?: number | null) => (g ? `${(g / 1000).toFixed(2)} kg` : '—');

  const badge = (prov: string | null) => {
    if (prov === 'test') {
      return (
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            padding: '2px 6px',
            borderRadius: 999,
            background: '#333',
            color: '#fff'
          }}
        >
          Test
        </span>
      );
    }
    if (prov === 'stripe') {
      return (
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            padding: '2px 6px',
            borderRadius: 999,
            background: '#e6f0ff',
            color: '#2255cc',
            border: '1px solid #c9dcff'
          }}
        >
          Stripe
        </span>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Orders</h1>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          placeholder="Search by email or order no."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          style={{ padding: '6px 8px', minWidth: 220 }}
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
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : rows.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1024 }}>
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
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} style={{ borderTop: '1px solid #333' }}>
                  <td style={td}>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      style={{ color: '#007bff', textDecoration: 'none' }}
                    >
                      {order.displayId ?? order.id}
                    </Link>
                    {badge(order.paymentProvider)}
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
