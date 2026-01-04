'use client';

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

interface OrderLite {
  id: string;
  displayId: string;
  contactEmail: string;
  status: string;
}
interface ShipmentLite {
  id: string;
  carrier: string;
  status: string;
  waybill: string | null;
  trackingNumber: string | null;
  trackingUrl?: string | null;
}

interface ReturnCase {
  id: string;
  orderId: string;
  shipmentId: string | null;

  status: ReturnCaseStatus;
  issueType: DeliveryIssueType;

  detectedAt: string;
  lastEventAt: string | null;

  resolution: ReturnResolution | null;
  resolutionNote: string | null;
  resolvedAt: string | null;

  meta: unknown;

  order: OrderLite;
  shipment: ShipmentLite | null;
}

type ApiOk<T> = { ok: true } & T;
interface ApiErr {
  ok: false;
  error: string;
}
type ApiResp<T> = ApiOk<T> | ApiErr;

async function j<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, data };
}

function pillTone(status: ReturnCaseStatus): { bg: string; br: string; fg: string } {
  if (status === 'OPEN')
    return { bg: 'rgba(245,158,11,0.10)', br: 'rgba(245,158,11,0.25)', fg: '#92400e' };
  if (status === 'RECEIVED')
    return { bg: 'rgba(59,130,246,0.10)', br: 'rgba(59,130,246,0.25)', fg: '#1e3a8a' };
  return { bg: 'rgba(16,185,129,0.10)', br: 'rgba(16,185,129,0.25)', fg: '#065f46' };
}

function formatGBP(pence: number) {
  const n = Number.isFinite(pence) ? pence : 0;
  return `£${(n / 100).toFixed(2)}`;
}

export default function ReturnDetailClient({ baseUrl, id }: { baseUrl: string; id: string }) {
  const [rc, setRc] = useState<ReturnCase | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // decision inputs
  const [note, setNote] = useState('');
  const [refundPence, setRefundPence] = useState<number>(0);
  const [storeCreditPence, setStoreCreditPence] = useState<number>(0);
  const [resolution, setResolution] = useState<ReturnResolution>('NO_ACTION');

  const getUrl = useMemo(
    () => `${baseUrl}/api/admin/returns/${encodeURIComponent(id)}`,
    [baseUrl, id]
  );

  async function refresh() {
    setErr(null);

    const r = await j<ApiResp<{ case: ReturnCase }>>(getUrl, { cache: 'no-store' });
    if (!r.ok || r.data.ok === false) {
      setErr((r.data as ApiErr)?.error ?? `Failed (${r.status})`);
      setRc(null);
      return;
    }

    const data = r.data as ApiOk<{ case: ReturnCase }>;
    setRc(data.case);

    setNote((data.case.resolutionNote ?? '') || '');
    setResolution((data.case.resolution ?? 'NO_ACTION') as ReturnResolution);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUrl]);

  async function act(path: string, body?: Record<string, unknown>) {
    setErr(null);
    setBusy(path);

    const r = await j<ApiResp<Record<string, unknown>>>(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });

    setBusy(null);

    if (!r.ok || r.data.ok === false) {
      setErr((r.data as ApiErr)?.error ?? `Action failed (${r.status})`);
      return;
    }

    await refresh();
  }

  const canAct = busy === null;

  if (!rc) {
    return (
      <div
        style={{
          border: '1px solid rgba(148,163,184,.35)',
          borderRadius: 16,
          padding: 14,
          opacity: 0.8
        }}
      >
        {err ? (
          <>
            <b>Error:</b> {err}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => refresh()} style={{ padding: '8px 12px' }}>
                Retry
              </button>
            </div>
          </>
        ) : (
          'Loading return case…'
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Header */}
      <div
        style={{
          border: '1px solid rgba(148,163,184,.35)',
          borderRadius: 16,
          padding: 14,
          display: 'grid',
          gap: 10
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
        >
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 950,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: `1px solid ${pillTone(rc.status).br}`,
                  background: pillTone(rc.status).bg,
                  color: pillTone(rc.status).fg
                }}
              >
                {rc.status}
              </span>

              <span style={{ fontSize: 12, opacity: 0.8 }}>
                Issue: <b>{rc.issueType}</b>
              </span>

              <span style={{ fontSize: 12, opacity: 0.8 }}>
                Detected: <b>{new Date(rc.detectedAt).toLocaleString('en-GB')}</b>
              </span>

              {rc.lastEventAt ? (
                <span style={{ fontSize: 12, opacity: 0.8 }}>
                  Last event: <b>{new Date(rc.lastEventAt).toLocaleString('en-GB')}</b>
                </span>
              ) : null}
            </div>

            <div style={{ fontSize: 13, opacity: 0.85 }}>
              Order: <b>#{rc.order.displayId}</b> — {rc.order.contactEmail}
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Shipment:{' '}
              {rc.shipment ? (
                <>
                  <b>{rc.shipment.carrier}</b> ·{' '}
                  {rc.shipment.trackingNumber ?? rc.shipment.waybill ?? '—'}
                </>
              ) : (
                '—'
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a
              href={`/admin/orders/${rc.orderId}`}
              style={{
                padding: '8px 12px',
                borderRadius: 12,
                border: '1px solid rgba(148,163,184,.35)',
                textDecoration: 'none',
                fontWeight: 900
              }}
            >
              Open order
            </a>

            {rc.shipmentId ? (
              <a
                href={`/admin/shipments/${rc.shipmentId}`}
                style={{
                  padding: '8px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,.35)',
                  textDecoration: 'none',
                  fontWeight: 900
                }}
              >
                Open shipment
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ border: '1px solid rgba(148,163,184,.35)', borderRadius: 16, padding: 14 }}>
        <div style={{ fontWeight: 950, marginBottom: 10 }}>Actions</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            disabled={!canAct || rc.status === 'RESOLVED'}
            onClick={() => act(`/api/admin/returns/${rc.id}/receive`)}
            style={{ padding: '8px 12px', fontWeight: 900 }}
          >
            {busy ? 'Working…' : 'Mark RECEIVED'}
          </button>

          <button
            disabled={!canAct || rc.status === 'RESOLVED'}
            onClick={() => act(`/api/admin/returns/${rc.id}/reship/create`)}
            style={{ padding: '8px 12px', fontWeight: 900 }}
          >
            {busy ? 'Working…' : 'Create reship'}
          </button>

          <button
            disabled={!canAct || rc.status === 'RESOLVED'}
            onClick={() =>
              act(`/api/admin/returns/${rc.id}/resolve`, { note: note.trim() || 'Resolved' })
            }
            style={{ padding: '8px 12px', fontWeight: 900 }}
          >
            {busy ? 'Working…' : 'Resolve'}
          </button>

          <button
            disabled={!canAct}
            onClick={() => refresh()}
            style={{ padding: '8px 12px', fontWeight: 900 }}
          >
            Refresh
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
            marginTop: 12
          }}
        >
          {/* Decision */}
          <div style={{ border: '1px solid rgba(148,163,184,.25)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Decision</div>

            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800 }}>
              Resolution
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as ReturnResolution)}
                style={{ padding: 8, borderRadius: 10, border: '1px solid rgba(148,163,184,.35)' }}
              >
                <option value="NO_ACTION">NO_ACTION</option>
                <option value="CUSTOMER_COLLECT">CUSTOMER_COLLECT</option>
                <option value="STORE_CREDIT">STORE_CREDIT</option>
                <option value="REFUND">REFUND</option>
                <option value="RESHIP">RESHIP</option>
              </select>
            </label>

            <label
              style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800, marginTop: 10 }}
            >
              Note
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Internal note (optional)"
                rows={3}
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: '1px solid rgba(148,163,184,.35)',
                  resize: 'vertical'
                }}
              />
            </label>

            {resolution === 'REFUND' ? (
              <label
                style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800, marginTop: 10 }}
              >
                Refund amount (pence)
                <input
                  type="number"
                  value={refundPence}
                  min={0}
                  step={1}
                  onChange={(e) =>
                    setRefundPence(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,.35)'
                  }}
                />
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  Preview: <b>{formatGBP(refundPence)}</b>
                </span>
              </label>
            ) : null}

            {resolution === 'STORE_CREDIT' ? (
              <label
                style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 800, marginTop: 10 }}
              >
                Store credit (pence)
                <input
                  type="number"
                  value={storeCreditPence}
                  min={0}
                  step={1}
                  onChange={(e) =>
                    setStoreCreditPence(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                  }
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid rgba(148,163,184,.35)'
                  }}
                />
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  Preview: <b>{formatGBP(storeCreditPence)}</b>
                </span>
              </label>
            ) : null}

            <button
              disabled={!canAct || rc.status === 'RESOLVED'}
              onClick={() =>
                act(`/api/admin/returns/${rc.id}/decide`, {
                  resolution,
                  note: note.trim() || undefined,
                  ...(resolution === 'REFUND' ? { refundAmountPence: refundPence } : {}),
                  ...(resolution === 'STORE_CREDIT' ? { storeCreditPence } : {})
                })
              }
              style={{ padding: '10px 12px', fontWeight: 950, borderRadius: 12, marginTop: 12 }}
            >
              {busy ? 'Working…' : 'Save decision'}
            </button>
          </div>

          {/* Meta */}
          <div style={{ border: '1px solid rgba(148,163,184,.25)', borderRadius: 14, padding: 12 }}>
            <div style={{ fontWeight: 950, marginBottom: 8 }}>Evidence (meta)</div>
            <pre
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                fontSize: 12,
                opacity: 0.85,
                background: 'rgba(148,163,184,.08)',
                border: '1px solid rgba(148,163,184,.20)',
                borderRadius: 12,
                padding: 10,
                maxHeight: 360,
                overflow: 'auto'
              }}
            >
              {JSON.stringify(rc.meta, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
