'use client';

import { useEffect, useState, useTransition } from 'react';

type ShipmentStatus = 'PENDING' | 'BOOKED' | 'LABEL_READY' | 'SHIPPED' | 'CANCELLED' | 'DELIVERED';

interface ShipmentLite {
  id: string;
  carrier: string;
  status: ShipmentStatus;
  waybill: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  labelMime: string | null;
  hasLabel: boolean;
  trackingEmailSentAt: string | null;
  updatedAt: string;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok || (data && data.ok === false)) throw new Error(data?.error ?? res.statusText);
  return data as T;
}

export default function ApcShipmentCard({ orderId }: { orderId: string }) {
  const [data, setData] = useState<ShipmentLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipments/apc`, { cache: 'no-store' });
      const j = (await res.json()) as { ok: boolean; shipment?: ShipmentLite; error?: string };
      if (!j.ok) throw new Error(j.error ?? 'Failed to load shipment');
      setData(j.shipment ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // light auto-refresh while label isn't ready
    const t = setInterval(() => {
      if (data && !data.hasLabel && (data.status === 'BOOKED' || data.status === 'PENDING')) load();
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const statusPill = (s: ShipmentStatus) => {
    const map: Record<ShipmentStatus, { bg: string; fg: string; label: string }> = {
      PENDING: { bg: '#fff7ed', fg: '#9a3412', label: 'Pending' },
      BOOKED: { bg: '#eff6ff', fg: '#1d4ed8', label: 'Booked' },
      LABEL_READY: { bg: '#ecfdf5', fg: '#065f46', label: 'Label ready' },
      SHIPPED: { bg: '#ecfdf5', fg: '#065f46', label: 'Shipped' },
      DELIVERED: { bg: '#ecfdf5', fg: '#065f46', label: 'Delivered' },
      CANCELLED: { bg: '#fef2f2', fg: '#991b1b', label: 'Cancelled' }
    };
    const c = map[s] ?? map.PENDING;
    return (
      <span
        style={{
          padding: '3px 8px',
          borderRadius: 999,
          background: c.bg,
          color: c.fg,
          fontSize: 12
        }}
      >
        {c.label}
      </span>
    );
  };

  const waybill = data?.waybill ?? null;

  return (
    <section style={{ border: '1px solid #222', borderRadius: 10, padding: 10 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}
      >
        <h3 style={{ margin: 0 }}>Shipment (APC)</h3>
        {data ? statusPill(data.status) : null}
      </div>

      {loading ? (
        <div style={{ color: '#888', marginTop: 8 }}>Loading shipment…</div>
      ) : err ? (
        <div style={{ color: '#b00020', marginTop: 8 }}>{err}</div>
      ) : !data ? (
        <div style={{ color: '#888', marginTop: 8 }}>No APC shipment yet.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
          <div style={{ fontSize: 13 }}>
            <strong>Waybill:</strong> {waybill ?? '—'}
          </div>

          <div style={{ fontSize: 13 }}>
            <strong>Tracking:</strong>{' '}
            {data.trackingUrl ? (
              <a
                href={data.trackingUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#007bff' }}
              >
                Open tracking →
              </a>
            ) : (
              '—'
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isPending || !waybill}
              onClick={() =>
                startTransition(async () => {
                  await postJson(`/api/admin/orders/${orderId}/labels/apc/retry`);
                  await load();
                })
              }
            >
              Retry label
            </button>

            <button
              type="button"
              disabled={isPending || !data.hasLabel}
              onClick={() =>
                window.open(
                  `/api/admin/orders/${orderId}/labels/apc/download`,
                  '_blank',
                  'noopener,noreferrer'
                )
              }
            >
              Download label
            </button>

            <button
              type="button"
              disabled={isPending || !waybill}
              onClick={() =>
                startTransition(async () => {
                  await postJson(`/api/admin/orders/${orderId}/shipments/apc/send-tracking`);
                  await load();
                })
              }
            >
              Resend tracking email
            </button>

            {data.trackingEmailSentAt ? (
              <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>
                Tracking email sent: {new Date(data.trackingEmailSentAt).toLocaleString('en-GB')}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>
                Tracking email not sent yet
              </span>
            )}
          </div>

          {!data.hasLabel && (data.status === 'BOOKED' || data.status === 'PENDING') ? (
            <div style={{ fontSize: 12, color: '#888' }}>
              Label can take a few minutes — cron will keep checking automatically.
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
