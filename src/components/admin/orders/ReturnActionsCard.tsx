// src/components/admin/orders/ReturnActionsCard.tsx
'use client';

import React, { useEffect, useMemo, useState, useTransition } from 'react';

type ReturnCaseStatus = 'OPEN' | 'IN_TRANSIT' | 'RECEIVED' | 'DECIDED' | 'CLOSED';
type ReturnReason =
  | 'DELIVERY_FAILED'
  | 'RETURN_TO_DEPOT'
  | 'RETURNED_TO_SENDER'
  | 'ADDRESS_INCOMPLETE'
  | 'CUSTOMER_UNAVAILABLE'
  | 'REFUSED'
  | 'DAMAGED'
  | 'LOST'
  | 'OTHER';

type ReturnDecision = 'RESHIP' | 'REFUND' | 'STORE_CREDIT' | 'NO_ACTION';

interface ReturnCase {
  id: string;
  status: ReturnCaseStatus;
  reason: ReturnReason;
  decision?: ReturnDecision | null;
  note: string | null;

  receivedAt: string | null;
  decidedAt: string | null;
  closedAt: string | null;

  originalShipmentId: string | null;
  reshipShipmentId: string | null;

  refundAmountPence: number | null;
  storeCreditPence: number | null;
}

interface GetReturnResponse {
  ok: boolean;
  returnCase: ReturnCase | null;
}
interface OpenReturnResponse {
  ok: true;
  returnCase: ReturnCase;
}

interface ApiOk {
  ok: true;
}
interface ApiFail {
  ok: false;
  error?: string;
}

function pounds(pence: number | null | undefined) {
  if (pence == null || Number.isNaN(pence)) return '—';
  if (pence <= 0) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function labelReason(r: ReturnReason) {
  switch (r) {
    case 'RETURNED_TO_SENDER':
      return 'Returned to sender';
    case 'DELIVERY_FAILED':
      return 'Delivery failed';
    case 'RETURN_TO_DEPOT':
      return 'Return to depot';
    case 'ADDRESS_INCOMPLETE':
      return 'Address incomplete';
    case 'CUSTOMER_UNAVAILABLE':
      return 'Customer unavailable';
    case 'REFUSED':
      return 'Refused';
    case 'DAMAGED':
      return 'Damaged';
    case 'LOST':
      return 'Lost';
    case 'OTHER':
    default:
      return 'Other';
  }
}

function labelStatus(s: ReturnCaseStatus) {
  switch (s) {
    case 'OPEN':
      return 'Open';
    case 'IN_TRANSIT':
      return 'In transit';
    case 'RECEIVED':
      return 'Received';
    case 'DECIDED':
      return 'Decided';
    case 'CLOSED':
      return 'Closed';
    default:
      return s;
  }
}

function badgeTone(status: ReturnCaseStatus): React.CSSProperties {
  // subtle, readable
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: '1px solid rgba(15,23,42,0.10)'
  };

  if (status === 'CLOSED') return { ...base, background: 'rgba(15,23,42,0.05)', color: '#0f172a' };
  if (status === 'RECEIVED')
    return { ...base, background: 'rgba(16,185,129,0.10)', color: '#065f46' };
  if (status === 'DECIDED')
    return { ...base, background: 'rgba(59,130,246,0.10)', color: '#1e40af' };
  return { ...base, background: 'rgba(245,158,11,0.10)', color: '#92400e' };
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store'
  });

  const text = await res.text();
  const json = (text ? (JSON.parse(text) as unknown) : {}) as unknown;

  const okFlag =
    typeof json === 'object' && json !== null && 'ok' in json
      ? Boolean((json as { ok?: unknown }).ok)
      : undefined;

  if (!res.ok || okFlag === false) {
    const err =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error?: unknown }).error ?? '')
        : '';
    throw new Error(err || res.statusText || 'Request failed');
  }

  return json as T;
}

/** Build a single pasteable blob for staff → dev handoff (NOT displayed on screen). */
function buildDebugPayload(orderId: string, rc: ReturnCase) {
  return JSON.stringify(
    {
      orderId,
      returnCaseId: rc.id,

      status: rc.status,
      reason: rc.reason,
      decision: rc.decision ?? null,
      note: rc.note ?? null,

      originalShipmentId: rc.originalShipmentId ?? null,
      reshipShipmentId: rc.reshipShipmentId ?? null,

      refundAmountPence: rc.refundAmountPence ?? null,
      storeCreditPence: rc.storeCreditPence ?? null,

      receivedAt: rc.receivedAt ?? null,
      decidedAt: rc.decidedAt ?? null,
      closedAt: rc.closedAt ?? null
    },
    null,
    2
  );
}

async function copyDebug(orderId: string, rc: ReturnCase) {
  try {
    await navigator.clipboard.writeText(buildDebugPayload(orderId, rc));
    return true;
  } catch {
    return false;
  }
}

export default function ReturnActionsCard({ orderId }: { orderId: string }) {
  const [rc, setRc] = useState<ReturnCase | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // form state
  const [reason, setReason] = useState<ReturnReason>('RETURNED_TO_SENDER');
  const [note, setNote] = useState('');
  const [refundPence, setRefundPence] = useState<string>('');
  const [creditPence, setCreditPence] = useState<string>('');

  const isClosed = rc?.status === 'CLOSED';

  const card: React.CSSProperties = useMemo(
    () => ({
      border: '1px solid rgba(15,23,42,0.10)',
      borderRadius: 16,
      padding: 14,
      background: 'linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%)',
      boxShadow: '0 10px 30px rgba(15,23,42,0.06)'
    }),
    []
  );

  async function refresh() {
    const res = await fetch(`/api/admin/orders/${orderId}/returns`, { cache: 'no-store' });
    const data = (await res.json()) as GetReturnResponse;
    if (data.ok) setRc(data.returnCase);
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  function collapseWithMessage(text: string) {
    // UX: collapse when case is done so staff aren’t staring at internals
    setRc(null);
    setMsg(text);
  }

  return (
    <div style={card}>
      {/* Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 950, color: '#0f172a' }}>Returns / Failed Delivery</div>

          {rc ? (
            <span style={badgeTone(rc.status)}>
              {labelStatus(rc.status)} • {labelReason(rc.reason)}
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
                background: 'rgba(15,23,42,0.04)',
                border: '1px solid rgba(15,23,42,0.08)',
                color: 'rgba(15,23,42,0.70)'
              }}
            >
              No case
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {rc ? (
            <button
              type="button"
              onClick={async () => {
                setMsg(null);
                const ok = await copyDebug(orderId, rc);
                setMsg(
                  ok
                    ? '📋 Debug info copied — send to dev'
                    : 'Could not copy debug info (browser blocked)'
                );
              }}
              style={{
                height: 36,
                borderRadius: 12,
                padding: '0 12px',
                border: '1px dashed rgba(15,23,42,0.22)',
                background: '#fff',
                fontWeight: 900,
                cursor: 'pointer',
                fontSize: 12
              }}
              title="Copies internal IDs + timestamps for developers (not shown on screen)"
            >
              Copy debug info
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => refresh()}
            style={{
              height: 36,
              borderRadius: 12,
              padding: '0 12px',
              border: '1px solid rgba(15,23,42,0.14)',
              background: '#fff',
              fontWeight: 900,
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Minimal staff summary (no IDs) */}
      <div style={{ marginTop: 10, fontSize: 13, color: 'rgba(15,23,42,0.70)' }}>
        {rc ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <b>Refund:</b> {pounds(rc.refundAmountPence)}
            </div>
            <div>
              <b>Store credit:</b> {pounds(rc.storeCreditPence)}
            </div>
            {rc.decision ? (
              <div>
                <b>Decision:</b>{' '}
                {rc.decision === 'STORE_CREDIT' ? 'Store credit' : rc.decision.toLowerCase()}
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            Open a case when delivery fails / returns, so it’s tracked and handled consistently.
          </div>
        )}
      </div>

      <div style={{ height: 1, background: 'rgba(15,23,42,0.08)', margin: '12px 0' }} />

      {/* No case → Open */}
      {!rc ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(15,23,42,0.55)' }}>
              Reason
            </span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              style={{
                height: 42,
                borderRadius: 12,
                padding: '0 12px',
                border: '1px solid rgba(15,23,42,0.14)'
              }}
            >
              <option value="RETURNED_TO_SENDER">Returned to sender</option>
              <option value="DELIVERY_FAILED">Delivery failed</option>
              <option value="RETURN_TO_DEPOT">Return to depot</option>
              <option value="ADDRESS_INCOMPLETE">Address incomplete</option>
              <option value="CUSTOMER_UNAVAILABLE">Customer unavailable</option>
              <option value="REFUSED">Refused</option>
              <option value="DAMAGED">Damaged</option>
              <option value="LOST">Lost</option>
              <option value="OTHER">Other</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(15,23,42,0.55)' }}>
              Note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              style={{
                borderRadius: 12,
                padding: '10px 12px',
                border: '1px solid rgba(15,23,42,0.14)'
              }}
            />
          </label>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setMsg(null);
              startTransition(async () => {
                try {
                  const res = await postJson<OpenReturnResponse>(
                    `/api/admin/orders/${orderId}/returns/open`,
                    {
                      reason,
                      note
                    }
                  );
                  setRc(res.returnCase);
                  setMsg('✅ Return case opened.');
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : 'Failed to open return case.');
                }
              });
            }}
            style={{
              height: 44,
              borderRadius: 12,
              border: '1px solid rgba(2,6,23,0.9)',
              background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
              color: '#fff',
              fontWeight: 950,
              cursor: 'pointer',
              opacity: isPending ? 0.75 : 1
            }}
          >
            {isPending ? 'Opening…' : 'Open return case'}
          </button>
        </div>
      ) : (
        /* Case exists → Actions */
        <div style={{ display: 'grid', gap: 10 }}>
          {/* If closed, keep it calm + allow staff to reopen by creating a new case if needed */}
          {isClosed ? (
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(15,23,42,0.04)',
                border: '1px solid rgba(15,23,42,0.08)',
                fontSize: 13,
                fontWeight: 850,
                color: 'rgba(15,23,42,0.78)'
              }}
            >
              This return case is closed.
              <div style={{ marginTop: 6, fontWeight: 650 }}>
                If this reopens operationally, click <b>Open return case</b> above to create a new
                one.
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isPending || isClosed}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    await postJson<ApiOk | ApiFail>(
                      `/api/admin/orders/${orderId}/returns/${rc.id}/receive`
                    );
                    await refresh();
                    setMsg('✅ Marked as received.');
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Failed to mark received.');
                  }
                });
              }}
              style={{
                height: 42,
                borderRadius: 12,
                padding: '0 14px',
                border: '1px solid rgba(15,23,42,0.14)',
                background: '#fff',
                fontWeight: 950,
                cursor: isClosed ? 'not-allowed' : 'pointer',
                opacity: isClosed ? 0.55 : 1
              }}
            >
              Mark return received
            </button>

            <button
              type="button"
              disabled={isPending || isClosed}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    await postJson<ApiOk | ApiFail>(
                      `/api/admin/orders/${orderId}/returns/${rc.id}/reship`,
                      {
                        carrier: 'APC Overnight'
                      }
                    );
                    await refresh();
                    setMsg('✅ Reship shipment created (now buy label for the new shipment).');
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Failed to create reship.');
                  }
                });
              }}
              style={{
                height: 42,
                borderRadius: 12,
                padding: '0 14px',
                border: '1px solid rgba(2,6,23,0.9)',
                background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
                color: '#fff',
                fontWeight: 950,
                cursor: isClosed ? 'not-allowed' : 'pointer',
                opacity: isClosed ? 0.55 : 1
              }}
            >
              Create reship shipment
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(15,23,42,0.55)' }}>
                Refund (pence)
              </span>
              <input
                value={refundPence}
                onChange={(e) => setRefundPence(e.target.value)}
                placeholder="e.g. 1599"
                style={{
                  height: 42,
                  borderRadius: 12,
                  padding: '0 12px',
                  border: '1px solid rgba(15,23,42,0.14)'
                }}
                disabled={isClosed}
              />
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: 'rgba(15,23,42,0.55)' }}>
                Store credit (pence)
              </span>
              <input
                value={creditPence}
                onChange={(e) => setCreditPence(e.target.value)}
                placeholder="e.g. 1599"
                style={{
                  height: 42,
                  borderRadius: 12,
                  padding: '0 12px',
                  border: '1px solid rgba(15,23,42,0.14)'
                }}
                disabled={isClosed}
              />
            </label>
          </div>

          {/* Decide actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isPending || isClosed}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    // If your API auto-closes on decision, this will refresh as CLOSED.
                    await postJson<ApiOk | ApiFail>(
                      `/api/admin/orders/${orderId}/returns/${rc.id}/decide`,
                      {
                        decision: 'REFUND',
                        refundAmountPence: refundPence ? Number(refundPence) : null
                      }
                    );

                    await refresh();

                    // Optional nice collapse (only if it ended up CLOSED)
                    // If your API sets CLOSED here, we collapse. If not, we keep it open.
                    const latestRes = await fetch(`/api/admin/orders/${orderId}/returns`, {
                      cache: 'no-store'
                    });
                    const latest = (await latestRes.json()) as GetReturnResponse;
                    const latestCase = latest.ok ? latest.returnCase : null;

                    if (latestCase?.status === 'CLOSED') {
                      collapseWithMessage('✅ Refund decision saved (case closed).');
                    } else {
                      setMsg('✅ Refund decision saved.');
                      setRc(latestCase);
                    }
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Failed to set refund decision.');
                  }
                });
              }}
              style={{
                height: 42,
                borderRadius: 12,
                padding: '0 14px',
                border: '1px solid rgba(15,23,42,0.14)',
                background: '#fff',
                fontWeight: 950,
                cursor: isClosed ? 'not-allowed' : 'pointer',
                opacity: isClosed ? 0.55 : 1
              }}
            >
              Decide: Refund
            </button>

            <button
              type="button"
              disabled={isPending || isClosed}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    await postJson<ApiOk | ApiFail>(
                      `/api/admin/orders/${orderId}/returns/${rc.id}/decide`,
                      {
                        decision: 'STORE_CREDIT',
                        storeCreditPence: creditPence ? Number(creditPence) : null
                      }
                    );

                    await refresh();

                    // Optional nice collapse if API auto-closes
                    const latestRes = await fetch(`/api/admin/orders/${orderId}/returns`, {
                      cache: 'no-store'
                    });
                    const latest = (await latestRes.json()) as GetReturnResponse;
                    const latestCase = latest.ok ? latest.returnCase : null;

                    if (latestCase?.status === 'CLOSED') {
                      collapseWithMessage('✅ Store credit decision saved (case closed).');
                    } else {
                      setMsg('✅ Store credit decision saved.');
                      setRc(latestCase);
                    }
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Failed to set credit decision.');
                  }
                });
              }}
              style={{
                height: 42,
                borderRadius: 12,
                padding: '0 14px',
                border: '1px solid rgba(15,23,42,0.14)',
                background: '#fff',
                fontWeight: 950,
                cursor: isClosed ? 'not-allowed' : 'pointer',
                opacity: isClosed ? 0.55 : 1
              }}
            >
              Decide: Store credit
            </button>

            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                setMsg(null);
                startTransition(async () => {
                  try {
                    await postJson<ApiOk | ApiFail>(
                      `/api/admin/orders/${orderId}/returns/${rc.id}/decide`,
                      {
                        decision: 'NO_ACTION',
                        close: true
                      }
                    );

                    // ✅ Collapse on close (your requested behaviour)
                    collapseWithMessage('✅ Case closed.');
                  } catch (e) {
                    setMsg(e instanceof Error ? e.message : 'Failed to close case.');
                  }
                });
              }}
              style={{
                height: 42,
                borderRadius: 12,
                padding: '0 14px',
                border: '1px solid rgba(15,23,42,0.14)',
                background: '#fff',
                fontWeight: 950,
                cursor: 'pointer'
              }}
            >
              Close case
            </button>
          </div>
        </div>
      )}

      {/* Message */}
      {msg ? (
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(15,23,42,0.04)',
            border: '1px solid rgba(15,23,42,0.08)',
            fontSize: 13,
            fontWeight: 800,
            color: '#0f172a'
          }}
        >
          {msg}
        </div>
      ) : null}
    </div>
  );
}
