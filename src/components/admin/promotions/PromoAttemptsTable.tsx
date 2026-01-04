'use client';

import { useEffect, useMemo, useState } from 'react';

interface Attempt {
  id: string;
  checkoutId: string | null;
  code: string;
  outcome: string;
  errorCode: string | null;
  currency: string;
  subtotalPence: number | null;
  shippingPence: number | null;
  discountPence: number;
  shippingDiscountPence: number;
  createdAt: string;

  userId: string | null;
  email: string | null;
  orderId: string | null;
  promotionId: string | null;

  order: null | {
    displayId: string;
    createdAt: string;
    contactEmail: string;
    status: string;
  };

  promotion: null | {
    name: string | null;
    code: string;
  };
}

function penceToGBP(p: number | null | undefined) {
  const n = Math.max(0, Math.trunc(p ?? 0));
  return `£${(n / 100).toFixed(2)}`;
}

export default function PromoAttemptsTable({
  promotionId,
  code
}: {
  promotionId?: string;
  code?: string;
}) {
  const [rows, setRows] = useState<Attempt[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [outcome, setOutcome] = useState<string>(''); // filter

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (promotionId) p.set('promotionId', promotionId);
    if (code) p.set('code', code);
    if (outcome) p.set('outcome', outcome);
    p.set('take', '50');
    if (cursor) p.set('cursor', cursor);
    return p.toString();
  }, [promotionId, code, outcome, cursor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/promo-attempts?${qs}`, { cache: 'no-store' });
        const j = (await res.json()) as {
          ok: boolean;
          attempts: Attempt[];
          nextCursor: string | null;
          summary: Record<string, number>;
        };
        if (!cancelled) {
          setRows(j.ok ? j.attempts : []);
          setNextCursor(j.ok ? j.nextCursor : null);
          setSummary(j.ok ? j.summary : {});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qs]);

  const totalShown = rows.length;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>Promo attempts</strong>
        <span style={{ opacity: 0.75 }}>{loading ? 'Loading…' : `${totalShown} shown`}</span>

        <label style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ opacity: 0.8 }}>Outcome</span>
          <select
            value={outcome}
            onChange={(e) => {
              setCursor(null);
              setOutcome(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="EVAL_OK">EVAL_OK</option>
            <option value="EVAL_ERR">EVAL_ERR</option>
            <option value="ORDER_APPLIED">ORDER_APPLIED</option>
            <option value="ORDER_NOT_APPLIED">ORDER_NOT_APPLIED</option>
            <option value="ORDER_REJECTED">ORDER_REJECTED</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap', opacity: 0.85 }}>
        {Object.keys(summary).length === 0 ? (
          <span>—</span>
        ) : (
          Object.entries(summary).map(([k, v]) => (
            <span key={k}>
              {k}: <strong>{v}</strong>
            </span>
          ))
        )}
      </div>

      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid rgba(0,0,0,0.15)' }}>
              <th style={{ padding: 8 }}>When</th>
              <th style={{ padding: 8 }}>Code</th>
              <th style={{ padding: 8 }}>Outcome</th>
              <th style={{ padding: 8 }}>Who</th>
              <th style={{ padding: 8 }}>Order</th>
              <th style={{ padding: 8 }}>Subtotal</th>
              <th style={{ padding: 8 }}>Ship</th>
              <th style={{ padding: 8 }}>Discount</th>
              <th style={{ padding: 8 }}>Ship Disc</th>
              <th style={{ padding: 8 }}>Error</th>
              <th style={{ padding: 8 }}>CheckoutId</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td style={{ padding: 8 }}>
                  <strong>{r.code}</strong>
                </td>
                <td style={{ padding: 8 }}>{r.outcome}</td>
                <td style={{ padding: 8 }}>
                  <div style={{ display: 'grid' }}>
                    <span style={{ opacity: 0.9 }}>{r.email ?? '—'}</span>
                    <span style={{ opacity: 0.7, fontSize: 12 }}>{r.userId ?? 'guest'}</span>
                  </div>
                </td>
                <td style={{ padding: 8 }}>
                  {r.order ? (
                    <div style={{ display: 'grid' }}>
                      <span>
                        <strong>{r.order.displayId}</strong>
                      </span>
                      <span style={{ opacity: 0.7, fontSize: 12 }}>{r.order.status}</span>
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: 8 }}>{penceToGBP(r.subtotalPence)}</td>
                <td style={{ padding: 8 }}>{penceToGBP(r.shippingPence)}</td>
                <td style={{ padding: 8 }}>{penceToGBP(r.discountPence)}</td>
                <td style={{ padding: 8 }}>{penceToGBP(r.shippingDiscountPence)}</td>
                <td style={{ padding: 8 }}>{r.errorCode ?? '—'}</td>
                <td style={{ padding: 8, fontSize: 12, opacity: 0.75 }}>{r.checkoutId ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td style={{ padding: 12, opacity: 0.75 }} colSpan={11}>
                  No attempts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => setCursor(null)} disabled={loading}>
          First page
        </button>
        <button
          type="button"
          onClick={() => setCursor(nextCursor)}
          disabled={loading || !nextCursor}
        >
          Next page
        </button>
      </div>
    </div>
  );
}
