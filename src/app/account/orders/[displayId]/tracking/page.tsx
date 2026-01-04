export const dynamic = 'force-dynamic';

interface HistoryEvent {
  at: string;
  type: string;
  note: string | null;
  shipmentId: string | null;
  carrier: string | null;
  waybill: string | null;
  trackingUrl: string | null;
}

type ApiResp =
  | {
      ok: true;
      order: { id: string; displayId: string; status: string; createdAt: string };
      shipments: Array<{
        id: string;
        carrier: string;
        serviceCode: string | null;
        status: string;
        waybill: string | null;
        trackingUrl: string | null;
        createdAt: string;
        shippedAt: string | null;
        updatedAt: string;
      }>;
      history: HistoryEvent[];
    }
  | { ok: false; error: string };

function labelForType(type: string) {
  switch (type) {
    case 'SHIPMENT_CREATED':
      return 'Shipment created';
    case 'LABEL_PURCHASED':
      return 'Label ready';
    case 'SHIPMENT_SHIPPED':
      return 'Dispatched';
    case 'SHIPMENT_DELIVERED':
      return 'Delivered';
    case 'SHIPMENT_CANCELLED':
      return 'Cancelled';
    default:
      return type;
  }
}

function dotColor(type: string) {
  switch (type) {
    case 'LABEL_PURCHASED':
      return '#22c55e';
    case 'SHIPMENT_SHIPPED':
      return '#60a5fa';
    case 'SHIPMENT_DELIVERED':
      return '#a78bfa';
    case 'SHIPMENT_CANCELLED':
      return '#ef4444';
    case 'SHIPMENT_CREATED':
      return '#f59e0b';
    default:
      return '#a3a3a3';
  }
}

function pill(status: string) {
  const s = status.toUpperCase();
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

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 999,
        border: '1px solid rgba(148,163,184,0.35)',
        background: 'rgba(2,6,23,0.45)',
        fontSize: 12,
        fontWeight: 900
      }}
    >
      <span style={{ width: 9, height: 9, borderRadius: 999, background: color }} />
      {s}
    </span>
  );
}

function baseUrlFromEnv() {
  const env = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  return env ? env.replace(/\/+$/, '') : '';
}

export default async function TrackingPage({
  params,
  searchParams
}: {
  params: Promise<{ displayId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { displayId } = await params;
  const sp = await searchParams;

  const email = typeof sp.email === 'string' ? sp.email : '';
  const qs = email ? `?email=${encodeURIComponent(email)}` : '';

  const base = baseUrlFromEnv();
  const apiUrl = base
    ? `${base}/api/orders/${displayId}/tracking${qs}`
    : `/api/orders/${displayId}/tracking${qs}`;

  const res = await fetch(apiUrl, { cache: 'no-store' }).catch(() => null);

  if (!res || !res.ok) {
    return (
      <div style={{ padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>Tracking</h1>
        <p style={{ color: '#94a3b8', fontWeight: 650 }}>
          We couldn’t load tracking for this order.
        </p>
      </div>
    );
  }

  const data = (await res.json()) as ApiResp;

  if (!data.ok) {
    return (
      <div style={{ padding: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>Tracking</h1>
        <p style={{ color: '#94a3b8', fontWeight: 650 }}>{data.error}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 950, margin: 0 }}>Your order is on the way</h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontWeight: 650 }}>
            Order <span style={{ color: '#e5e7eb', fontWeight: 900 }}>{data.order.displayId}</span>
          </p>
        </div>
        <div>{pill(data.order.status)}</div>
      </div>

      {/* Shipment list */}
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
            gridTemplateColumns: '180px 1fr 220px 220px',
            padding: '12px 14px',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            fontSize: 12,
            fontWeight: 950,
            color: '#e5e7eb'
          }}
        >
          <div>Status</div>
          <div>Shipment</div>
          <div>Created</div>
          <div>Shipped</div>
        </div>

        {data.shipments.length === 0 ? (
          <div style={{ padding: 14, color: '#cbd5e1' }}>
            No shipments yet. Please check back shortly.
          </div>
        ) : (
          data.shipments.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '180px 1fr 220px 220px',
                padding: '12px 14px',
                borderTop: '1px solid rgba(148,163,184,0.12)',
                alignItems: 'center',
                color: '#e5e7eb'
              }}
            >
              <div>{pill(s.status)}</div>

              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontWeight: 950 }}>{s.carrier}</div>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                  {s.waybill ?? '—'}
                  {s.trackingUrl ? (
                    <>
                      {' '}
                      •{' '}
                      <a
                        href={s.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#93c5fd', fontWeight: 850 }}
                      >
                        Track parcel
                      </a>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                {new Date(s.createdAt).toLocaleString()}
              </div>

              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                {s.shippedAt ? new Date(s.shippedAt).toLocaleString() : '—'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* History timeline */}
      <div
        style={{
          borderRadius: 20,
          border: '1px solid rgba(148,163,184,0.35)',
          background: 'rgba(2,6,23,0.35)',
          padding: 14
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 950, color: '#e5e7eb' }}>
            Shipment history
          </h2>
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 650 }}>Latest first</span>
        </div>

        {data.history.length === 0 ? (
          <p style={{ margin: '10px 0 0', color: '#cbd5e1' }}>No shipment events yet.</p>
        ) : (
          <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
            {data.history.map((h, idx) => (
              <div
                key={`${h.at}-${idx}`}
                style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10 }}
              >
                <div style={{ display: 'grid', justifyItems: 'center' }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      marginTop: 3,
                      background: dotColor(h.type)
                    }}
                  />
                  <span style={{ width: 2, flex: 1, background: 'rgba(148,163,184,0.18)' }} />
                </div>

                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 950, color: '#e5e7eb' }}>
                      {labelForType(h.type)}
                    </span>
                    <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 650 }}>
                      {new Date(h.at).toLocaleString()}
                    </span>
                  </div>

                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                    {h.carrier ? `${h.carrier}` : ''}
                    {h.waybill ? (h.carrier ? ` • ${h.waybill}` : h.waybill) : ''}
                    {h.trackingUrl ? (
                      <>
                        {' '}
                        •{' '}
                        <a
                          href={h.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#93c5fd', fontWeight: 850 }}
                        >
                          Tracking
                        </a>
                      </>
                    ) : null}
                  </div>

                  {h.note ? <div style={{ fontSize: 12, color: '#94a3b8' }}>{h.note}</div> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p style={{ margin: 0, color: '#94a3b8', fontSize: 12, fontWeight: 650 }}>
        Multi-parcel aware: if your order ships in more than one box, you’ll see multiple shipments
        above.
      </p>
    </div>
  );
}
