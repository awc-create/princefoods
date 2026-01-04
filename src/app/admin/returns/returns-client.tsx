'use client';

import { urlFrom } from '@/lib/url';
import { useEffect, useMemo, useState } from 'react';

type ReturnCaseStatus = 'OPEN' | 'RECEIVED' | 'RESOLVED';
type DeliveryIssueType =
  | 'DELIVERY_FAILED'
  | 'RETURN_TO_DEPOT'
  | 'RETURN_TO_SENDER'
  | 'LOST'
  | 'DAMAGED'
  | 'UNKNOWN';
type ReturnResolution = 'RESHIP' | 'REFUND' | 'STORE_CREDIT' | 'CUSTOMER_COLLECT' | 'NO_ACTION';

type StatusFilter = ReturnCaseStatus | 'ALL';

interface CaseRow {
  id: string;
  orderId: string;
  shipmentId: string | null;
  status: ReturnCaseStatus;
  issueType: DeliveryIssueType;
  detectedAt: string;
  lastEventAt: string | null;
  receivedAt: string | null;
  resolvedAt: string | null;
  resolution: ReturnResolution | null;
  resolutionNote: string | null;
  order: { id: string; displayId: string; contactEmail: string; status: string };
  shipment: {
    id: string;
    carrier: string;
    status: string;
    waybill: string | null;
    trackingNumber: string | null;
  } | null;
}

type ApiEnvelope<T> = { ok?: boolean; error?: string } & T;

interface DecideBody {
  resolution: ReturnResolution;
  note?: string;
  refundAmountPence?: number;
}

interface ResolveBody {
  note?: string;
}
type ActBody = DecideBody | ResolveBody | undefined;

function isStatusFilter(v: string): v is StatusFilter {
  return v === 'ALL' || v === 'OPEN' || v === 'RECEIVED' || v === 'RESOLVED';
}

async function j<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

export default function ReturnsClient({ baseUrl }: { baseUrl: string }) {
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const queryUrl = useMemo(() => {
    const u = urlFrom('/api/admin/returns', baseUrl);
    if (status !== 'ALL') u.searchParams.set('status', status);
    if (q.trim()) u.searchParams.set('q', q.trim());
    return u.toString();
  }, [baseUrl, status, q]);

  async function refresh() {
    setErr(null);
    const r = await j<ApiEnvelope<{ cases?: CaseRow[] }>>(queryUrl, { cache: 'no-store' });

    if (!r.ok || r.data.ok === false) {
      setErr(r.data.error ?? `Failed (${r.status})`);
      return;
    }
    setRows(r.data.cases ?? []);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryUrl]);

  async function act(path: string, body?: ActBody) {
    if (!path) return;
    setErr(null);
    setBusy(true);

    const target = urlFrom(path, baseUrl).toString();

    const r = await j<ApiEnvelope<Record<string, unknown>>>(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });

    setBusy(false);

    if (!r.ok || r.data.ok === false) {
      setErr(r.data.error ?? `Action failed (${r.status})`);
      return;
    }

    await refresh();
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            if (isStatusFilter(v)) setStatus(v);
          }}
          style={{ padding: 8 }}
        >
          <option value="OPEN">OPEN</option>
          <option value="RECEIVED">RECEIVED</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="ALL">ALL</option>
        </select>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search order #, email, shipmentId..."
          style={{ padding: 8, minWidth: 260, flex: 1 }}
        />

        <button onClick={() => refresh()} style={{ padding: '8px 12px' }} disabled={busy}>
          Refresh
        </button>
      </div>

      {err ? (
        <div style={{ padding: 10, border: '1px solid #ff6b6b', borderRadius: 12 }}>{err}</div>
      ) : null}

      <div
        style={{ border: '1px solid rgba(148,163,184,.35)', borderRadius: 16, overflow: 'hidden' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(148,163,184,.08)' }}>
              <th style={{ textAlign: 'left', padding: 10 }}>Order</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Status</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Issue</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Shipment</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Detected</th>
              <th style={{ textAlign: 'left', padding: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(148,163,184,.18)' }}>
                <td style={{ padding: 10 }}>
                  <div style={{ fontWeight: 800 }}>#{r.order.displayId}</div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>{r.order.contactEmail}</div>
                </td>

                <td style={{ padding: 10 }}>{r.status}</td>
                <td style={{ padding: 10 }}>{r.issueType}</td>

                <td style={{ padding: 10, fontSize: 12 }}>
                  {r.shipment ? (
                    <>
                      <div>{r.shipment.carrier}</div>
                      <div style={{ opacity: 0.8 }}>
                        {r.shipment.trackingNumber ?? r.shipment.waybill ?? '—'}
                      </div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>

                <td style={{ padding: 10, fontSize: 12 }}>
                  {new Date(r.detectedAt).toLocaleString()}
                </td>

                <td style={{ padding: 10 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      disabled={busy}
                      onClick={() => act(`/api/admin/returns/${r.id}/receive`)}
                      style={{ padding: '6px 10px' }}
                    >
                      Mark received
                    </button>

                    <button
                      disabled={busy}
                      onClick={() =>
                        act(`/api/admin/returns/${r.id}/decide`, {
                          resolution: 'RESHIP',
                          note: 'Reship requested'
                        })
                      }
                      style={{ padding: '6px 10px' }}
                    >
                      Decide reship
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => act(`/api/admin/returns/${r.id}/reship/create`)}
                      style={{ padding: '6px 10px' }}
                    >
                      Create reship shipment
                    </button>

                    <button
                      disabled={busy}
                      onClick={() =>
                        act(`/api/admin/returns/${r.id}/decide`, {
                          resolution: 'REFUND',
                          refundAmountPence: 0,
                          note: 'Refund approved (set amount in meta)'
                        })
                      }
                      style={{ padding: '6px 10px' }}
                    >
                      Decide refund
                    </button>

                    <button
                      disabled={busy}
                      onClick={() =>
                        act(`/api/admin/returns/${r.id}/resolve`, { note: 'Resolved' })
                      }
                      style={{ padding: '6px 10px' }}
                    >
                      Resolve
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!rows.length ? (
              <tr>
                <td colSpan={6} style={{ padding: 14, opacity: 0.8 }}>
                  No return cases found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
