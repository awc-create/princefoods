// src/app/admin/shipments/shipments-client.tsx
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';

interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  serviceCode: string | null;
  waybill: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  shippedAt: string | null;

  labelBase64: string | null;
  labelUrl: string | null;
  labelMime: string | null;

  trackingEmailSentAt: string | null;

  order: {
    id: string;
    displayId: string;
    contactEmail: string;
    status: string;
  } | null;
}

type ApiResp = { ok: true; shipments: Shipment[] } | { ok: false; error: string } | unknown;

function pill(status: string) {
  const s = String(status ?? '').toUpperCase();

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    borderRadius: 999,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(2,6,23,0.45)',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.2
  };

  const color =
    s === 'LABEL_READY'
      ? '#22c55e'
      : s === 'BOOKED'
        ? '#f59e0b'
        : s === 'SHIPPED'
          ? '#60a5fa'
          : s === 'CANCELLED'
            ? '#ef4444'
            : s === 'DELIVERED'
              ? '#a78bfa'
              : '#a3a3a3';

  return { base, dot: color, label: s || 'UNKNOWN' };
}

function inputStyle(): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 12,
    border: '1px solid rgba(148,163,184,0.35)',
    background: 'rgba(2,6,23,0.55)',
    color: '#e5e7eb',
    outline: 'none'
  };
}

function btnStyle(kind: 'neutral' | 'primary' | 'danger', disabled?: boolean): React.CSSProperties {
  const common: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 12,
    fontWeight: 900,
    fontSize: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    border: '1px solid rgba(148,163,184,0.35)'
  };

  if (kind === 'danger') {
    return {
      ...common,
      border: '1px solid rgba(239,68,68,0.35)',
      background: 'rgba(127,29,29,0.25)',
      color: '#fee2e2'
    };
  }

  if (kind === 'primary') {
    return {
      ...common,
      background: 'rgba(15,23,42,0.8)',
      color: '#e5e7eb'
    };
  }

  return {
    ...common,
    background: 'rgba(2,6,23,0.55)',
    color: '#e5e7eb'
  };
}

function qsSet(sp: URLSearchParams, key: string, value: string) {
  const next = new URLSearchParams(sp.toString());
  if (!value) next.delete(key);
  else next.set(key, value);
  return next;
}

function asInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isApiOk(x: unknown): x is { ok: true; shipments: Shipment[] } {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return r.ok === true;
}
function isApiErr(x: unknown): x is { ok: false; error: string } {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  return r.ok === false && typeof r.error === 'string';
}

export default function ShipmentsClient() {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/shipments';
  const spRaw = useSearchParams();

  // ✅ always have a URLSearchParams instance
  const sp = useMemo(() => new URLSearchParams(spRaw?.toString() ?? ''), [spRaw]);

  const [rows, setRows] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const q = (sp.get('q') ?? '').trim();
  const status = (sp.get('status') ?? '').trim();
  const carrier = (sp.get('carrier') ?? '').trim();
  const hasLabel = (sp.get('hasLabel') ?? '').trim(); // "1" | "0" | ""
  const take = Math.min(Math.max(asInt(sp.get('take'), 50), 10), 200);

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams();

    if (q) qs.set('q', q);
    if (status) qs.set('status', status);
    if (carrier) qs.set('carrier', carrier);
    if (hasLabel) qs.set('hasLabel', hasLabel);

    qs.set('take', String(take));

    const s = qs.toString();
    return s ? `/api/admin/shipments?${s}` : '/api/admin/shipments';
  }, [q, status, carrier, hasLabel, take]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(apiUrl, { cache: 'no-store' });
      const json = (await res.json().catch(() => null)) as ApiResp;

      if (!res.ok) {
        // try to surface API error if present
        if (isApiErr(json)) throw new Error(json.error);
        throw new Error(`Failed to load shipments (${res.status})`);
      }

      if (isApiErr(json)) throw new Error(json.error);

      if (isApiOk(json)) {
        const safe = Array.isArray(json.shipments) ? json.shipments : [];
        setRows(safe);
      } else {
        // unknown shape: never crash UI
        setRows([]);
        throw new Error('Unexpected response from server');
      }
    } catch (e) {
      setRows([]); // ✅ ensure rows is ALWAYS an array
      setErr(e instanceof Error ? e.message : 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!alive) return;
      await load();
    })();

    return () => {
      alive = false;
    };
  }, [load]);

  function pushParam(key: string, value: string) {
    startTransition(() => {
      const next = qsSet(new URLSearchParams(sp.toString()), key, value);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function clearFilters() {
    router.push(pathname);
  }

  function reprint(id: string) {
    window.open(`/api/admin/shipments/${id}/label?download=1`, '_blank', 'noopener,noreferrer');
  }

  async function postJson(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {})
    });

    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

    if (!res.ok || !json?.ok) {
      throw new Error(json?.error ?? `Request failed (${res.status})`);
    }
  }

  async function retryLabel(id: string) {
    setBusy(id);
    setErr(null);
    try {
      await postJson(`/api/admin/shipments/${id}/label/retry`, {});
      await load(); // ✅ refresh this page’s data
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setBusy(null);
    }
  }

  async function dispatch(id: string) {
    setBusy(id);
    setErr(null);
    try {
      await postJson(`/api/admin/shipments/${id}/dispatch`, { includeLabelLink: true });
      await load();
      router.refresh(); // optional (if you also have server components depending on this)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Dispatch failed');
    } finally {
      setBusy(null);
    }
  }

  async function voidShipment(id: string) {
    setBusy(id);
    setErr(null);
    try {
      await postJson(`/api/admin/shipments/${id}/void`, {});
      await load();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Void failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr 1fr auto',
          gap: 10,
          padding: 12,
          borderRadius: 18,
          border: '1px solid rgba(148,163,184,0.35)',
          background: 'rgba(15,23,42,0.6)'
        }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#e5e7eb' }}>Search</span>
          <input
            value={q}
            onChange={(e) => pushParam('q', e.target.value)}
            placeholder="waybill / tracking / order displayId…"
            style={inputStyle()}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#e5e7eb' }}>Status</span>
          <select
            value={status}
            onChange={(e) => pushParam('status', e.target.value)}
            style={inputStyle()}
          >
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="BOOKED">BOOKED</option>
            <option value="LABEL_READY">LABEL_READY</option>
            <option value="SHIPPED">SHIPPED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="DELIVERED">DELIVERED</option>
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#e5e7eb' }}>Carrier</span>
          <input
            value={carrier}
            onChange={(e) => pushParam('carrier', e.target.value)}
            placeholder="APC…"
            style={inputStyle()}
          />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#e5e7eb' }}>Has label</span>
          <select
            value={hasLabel}
            onChange={(e) => pushParam('hasLabel', e.target.value)}
            style={inputStyle()}
          >
            <option value="">All</option>
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </label>

        <button type="button" onClick={clearFilters} style={btnStyle('neutral')}>
          Clear
        </button>
      </div>

      {err && (
        <div
          style={{
            padding: 12,
            borderRadius: 16,
            border: '1px solid rgba(239,68,68,0.35)',
            background: 'rgba(127,29,29,0.25)',
            color: '#fecaca',
            fontWeight: 850
          }}
        >
          {err}
        </div>
      )}

      {/* Table */}
      <div
        style={{
          borderRadius: 20,
          border: '1px solid rgba(148,163,184,0.35)',
          background: 'rgba(15,23,42,0.6)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '160px 200px 1fr 190px 360px',
            padding: '12px 14px',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            fontSize: 12,
            fontWeight: 950,
            color: '#e5e7eb'
          }}
        >
          <div>Status</div>
          <div>Order</div>
          <div>Carrier / Waybill</div>
          <div>Created</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {loading || isPending ? (
          <div style={{ padding: 14, color: '#cbd5e1' }}>Loading shipments…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 14, color: '#cbd5e1' }}>No shipments found.</div>
        ) : (
          rows.map((s, idx) => {
            const p = pill(s.status);

            const hasLabelBool = Boolean(s.labelBase64 ?? s.labelUrl);
            const canDispatch =
              s.status !== 'SHIPPED' && s.status !== 'DELIVERED' && s.status !== 'CANCELLED';
            const canVoid = s.status !== 'SHIPPED' && s.status !== 'DELIVERED';

            const disabled = busy === s.id;

            const wb = s.waybill ?? s.trackingNumber ?? '—';

            return (
              <div
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 200px 1fr 190px 360px',
                  padding: '12px 14px',
                  borderTop: idx === 0 ? undefined : '1px solid rgba(148,163,184,0.12)',
                  alignItems: 'center',
                  color: '#e5e7eb'
                }}
              >
                <div>
                  <span style={p.base}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: p.dot }} />
                    {p.label}
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ fontWeight: 950 }}>
                    {s.order?.displayId ?? s.orderId?.slice?.(0, 8) ?? '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {s.order?.contactEmail ?? '—'}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ fontWeight: 900 }}>{s.carrier}</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    {wb}
                    {s.trackingUrl ? (
                      <>
                        {' '}
                        •{' '}
                        <a
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#93c5fd', fontWeight: 800 }}
                        >
                          tracking
                        </a>
                      </>
                    ) : null}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                  {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    disabled={!hasLabelBool}
                    onClick={() => reprint(s.id)}
                    style={btnStyle('neutral', !hasLabelBool)}
                  >
                    Reprint
                  </button>

                  <button
                    type="button"
                    disabled={hasLabelBool || disabled}
                    onClick={() => retryLabel(s.id)}
                    style={btnStyle('primary', hasLabelBool || disabled)}
                    title={hasLabelBool ? 'Label already exists' : 'Retry label fetch from APC'}
                  >
                    {disabled ? 'Working…' : 'Retry label'}
                  </button>

                  <button
                    type="button"
                    disabled={!canDispatch || disabled}
                    onClick={() => dispatch(s.id)}
                    style={btnStyle('primary', !canDispatch || disabled)}
                  >
                    {disabled ? 'Working…' : 'Dispatch'}
                  </button>

                  <button
                    type="button"
                    disabled={!canVoid || disabled}
                    onClick={() => voidShipment(s.id)}
                    style={btnStyle('danger', !canVoid || disabled)}
                  >
                    Void
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ margin: 0, color: '#94a3b8', fontSize: 12, fontWeight: 650 }}>
        Tip: “Retry label” is only enabled when there is no label stored (base64/url).
      </p>
    </div>
  );
}
