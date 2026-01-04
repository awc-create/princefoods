'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './Promotions.module.scss';

interface PromoRedemptionRow {
  id: string;
  createdAt: string;

  code: string;
  promotionId: string;
  promotionName: string | null;
  promotionStatus?: string | null;

  orderId: string;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
}

interface PromoAttemptRow {
  id: string;
  createdAt: string;

  code: string;
  outcome: 'APPLIED' | 'REJECTED';
  errorCode: string | null;

  promotionId: string | null;
  promotionName: string | null;

  orderId: string | null;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;

  subtotalPence: number | null;
  shippingPence: number | null;
  discountPence: number;
  shippingDiscountPence: number;
}

interface ApiOk {
  ok: true;
  since: string;
  customer?: { id: string; email?: string | null };
  redemptions: PromoRedemptionRow[];
  attempts: PromoAttemptRow[];
}

interface ApiErr {
  ok: false;
  error: string;
}

function fmtDateTime(d: string) {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleString();
}

function penceToGBP(p: number) {
  const x = Math.max(0, Math.trunc(p));
  return `£${(x / 100).toFixed(2)}`;
}

function statusPill(outcome: 'APPLIED' | 'REJECTED') {
  return outcome === 'REJECTED' ? styles.pillBad : styles.pillWarn;
}

export default function CustomerPromotions({
  customerId,
  daysDefault = 365,
  includeAttemptsDefault = true
}: {
  customerId: string;
  daysDefault?: number;
  includeAttemptsDefault?: boolean;
}) {
  const [days, setDays] = useState(String(daysDefault));
  const [includeAttempts, setIncludeAttempts] = useState(includeAttemptsDefault);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [since, setSince] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<PromoRedemptionRow[]>([]);
  const [attempts, setAttempts] = useState<PromoAttemptRow[]>([]);

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const d = Math.max(1, Math.min(3650, Number(days || String(daysDefault))));
      const url = `/api/customers/${customerId}/promotions?days=${d}&includeAttempts=${
        includeAttempts ? '1' : '0'
      }`;

      const res = await fetch(url, { cache: 'no-store' });
      const json = (await res.json()) as ApiOk | ApiErr;

      if (!res.ok || !json.ok) {
        setErr((json as ApiErr).error ?? 'Failed to load promotions.');
        setRedemptions([]);
        setAttempts([]);
        setSince(null);
        return;
      }

      const ok = json as ApiOk;
      setSince(ok.since ?? null);
      setRedemptions(ok.redemptions ?? []);
      setAttempts(ok.attempts ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load promotions.');
      setRedemptions([]);
      setAttempts([]);
      setSince(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const summary = useMemo(() => {
    const redeemedCount = redemptions.length;

    // best-effort: attempts discount is “attempt-time” not order-time,
    // still useful for support; redemptions don’t carry amounts here.
    const attemptDiscountPence = attempts.reduce(
      (sum, a) => sum + Math.max(0, (a.discountPence ?? 0) + (a.shippingDiscountPence ?? 0)),
      0
    );

    const rejected = attempts.filter((a) => a.outcome === 'REJECTED').length;

    return { redeemedCount, attemptDiscountPence, rejected };
  }, [redemptions, attempts]);

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <div>
          <h3 className={styles.h3}>Promotions</h3>
          <p className={styles.sub}>
            Redeemed promotions + (optional) recent promo attempts for support.
          </p>
        </div>

        <div className={styles.headRight}>
          <div className={styles.daysRow}>
            <span className={styles.smallLabel}>Days</span>
            <input
              className={styles.daysInput}
              inputMode="numeric"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="365"
            />
          </div>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={includeAttempts}
              onChange={(e) => setIncludeAttempts(e.target.checked)}
            />
            <span>Include attempts</span>
          </label>

          <button
            type="button"
            className={styles.btn}
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Reload'}
          </button>
        </div>
      </div>

      {err && <div className={styles.error}>{err}</div>}

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{summary.redeemedCount}</div>
          <div className={styles.kpiLabel}>Redeemed</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{attempts.length}</div>
          <div className={styles.kpiLabel}>Attempts</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{summary.rejected}</div>
          <div className={styles.kpiLabel}>Rejected</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiNum}>{penceToGBP(summary.attemptDiscountPence)}</div>
          <div className={styles.kpiLabel}>Attempt discount (est.)</div>
        </div>
      </div>

      {since && (
        <p className={styles.note}>
          Showing since <strong>{new Date(since).toLocaleDateString()}</strong>
        </p>
      )}

      {/* Redeemed */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Redeemed ({redemptions.length})
          <span className={styles.sectionHint}>Canonical “used” promos</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Code</th>
                <th>Promotion</th>
                <th>Order</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className={styles.mutedCell}>
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && redemptions.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.mutedCell}>
                    No redeemed promotions.
                  </td>
                </tr>
              )}

              {!loading &&
                redemptions.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDateTime(r.createdAt)}</td>
                    <td>
                      <span className={styles.code}>{r.code}</span>
                    </td>
                    <td>{r.promotionName ?? '—'}</td>
                    <td>
                      <Link className={styles.link} href={`/admin/orders/${r.orderId}`}>
                        {r.orderDisplayId ?? r.orderId.slice(0, 8)}
                      </Link>
                    </td>
                    <td>{r.orderPaymentStatus ?? r.orderStatus ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attempts */}
      {includeAttempts && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Attempts ({attempts.length})
            <span className={styles.sectionHint}>Includes invalid/blocked/applied-no-order</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Code</th>
                  <th>Outcome</th>
                  <th>Order</th>
                  <th>Discount</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className={styles.mutedCell}>
                      Loading…
                    </td>
                  </tr>
                )}

                {!loading && attempts.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.mutedCell}>
                      No attempts found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  attempts.slice(0, 50).map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDateTime(a.createdAt)}</td>
                      <td>
                        <span className={styles.code}>{a.code}</span>
                      </td>
                      <td>
                        <span className={`${styles.pill} ${statusPill(a.outcome)}`}>
                          {a.outcome}
                        </span>
                      </td>
                      <td>
                        {a.orderId ? (
                          <Link className={styles.link} href={`/admin/orders/${a.orderId}`}>
                            {a.orderDisplayId ?? a.orderId.slice(0, 8)}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        -{penceToGBP((a.discountPence ?? 0) + (a.shippingDiscountPence ?? 0))}
                      </td>
                      <td>{a.errorCode ?? (a.outcome === 'REJECTED' ? 'Invalid/blocked' : '—')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {attempts.length > 50 && (
            <div className={styles.mutedFoot}>Showing latest 50 attempts.</div>
          )}
        </div>
      )}
    </div>
  );
}
