'use client';

import styles from '@/app/admin/offers/offers.module.scss';
import { useMemo, useState } from 'react';

interface Attempt {
  id: string;
  createdAt: string;

  offerId?: string | null;
  offerName?: string | null;

  outcome: 'APPLIED' | 'REJECTED';
  redeemedOnOrder: boolean;

  email?: string | null;
  userId?: string | null;

  orderId?: string | null;
  orderDisplayId?: string | null;
  orderStatus?: string | null;
  orderPaymentStatus?: string | null;

  discountPence: number;
  shippingDiscountPence: number;

  subtotalPence?: number | null;
  shippingPence?: number | null;

  errorCode?: string | null;
}

interface Redemption {
  id: string;
  createdAt: string;

  offerId: string;
  offerName?: string | null;

  email?: string | null;
  userId?: string | null;

  orderId: string;
  orderDisplayId?: string | null;
  orderStatus?: string | null;
  orderPaymentStatus?: string | null;

  discountPence: number;
  shippingDiscountPence: number;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function penceToGBP(p: number) {
  const v = (p ?? 0) / 100;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'GBP' });
}

export default function OffersUsagePanel({
  loading,
  error,
  days,
  setDays,
  onReload,
  attempts,
  redemptions
}: {
  loading: boolean;
  error: string | null;
  days: string;
  setDays: (v: string) => void;
  onReload: () => void;
  attempts: Attempt[];
  redemptions: Redemption[];
}) {
  const [view, setView] = useState<'attempts' | 'redemptions'>('attempts');

  const summary = useMemo(() => {
    const totalAttempts = attempts.length;
    const applied = attempts.filter((a) => a.outcome === 'APPLIED').length;
    const rejected = attempts.filter((a) => a.outcome === 'REJECTED').length;
    const redeemed = attempts.filter((a) => a.redeemedOnOrder).length;

    const appliedNotUsedOnPayment = attempts.filter(
      (a) => a.outcome === 'APPLIED' && a.orderPaymentStatus === 'CAPTURED' && !a.redeemedOnOrder
    ).length;

    const appliedNoOrder = attempts.filter((a) => a.outcome === 'APPLIED' && !a.orderId).length;

    return { totalAttempts, applied, rejected, redeemed, appliedNotUsedOnPayment, appliedNoOrder };
  }, [attempts]);

  return (
    <>
      {error && <div className={styles.bannerError}>{error}</div>}

      <div className={styles.usageRow}>
        <div className={styles.usageCard}>
          <div className={styles.usageKpi}>{summary.totalAttempts}</div>
          <div className={styles.usageLabel}>Attempts</div>
        </div>
        <div className={styles.usageCard}>
          <div className={styles.usageKpi}>{summary.applied}</div>
          <div className={styles.usageLabel}>Applied</div>
        </div>
        <div className={styles.usageCard}>
          <div className={styles.usageKpi}>{summary.redeemed}</div>
          <div className={styles.usageLabel}>Redeemed</div>
        </div>
        <div className={styles.usageCard}>
          <div className={styles.usageKpi}>{summary.appliedNotUsedOnPayment}</div>
          <div className={styles.usageLabel}>Applied but not used</div>
        </div>
        <div className={styles.usageCard}>
          <div className={styles.usageKpi}>{summary.rejected}</div>
          <div className={styles.usageLabel}>Rejected</div>
        </div>
      </div>

      <div className={styles.filters} style={{ borderRadius: 18 }}>
        <div className={styles.searchWrap}>
          <div className={styles.hint}>
            Shows last {days} days (max 365). Includes invalid/unused attempts.
          </div>
        </div>

        <input
          className={styles.search}
          style={{ maxWidth: 140 }}
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Days"
        />

        <button type="button" className={styles.secondaryBtn} onClick={onReload} disabled={loading}>
          {loading ? 'Loading…' : 'Reload'}
        </button>
      </div>

      <div className={styles.tabs} style={{ marginTop: 10 }}>
        <button
          type="button"
          className={`${styles.tabBtn} ${view === 'attempts' ? styles.tabActive : ''}`}
          onClick={() => setView('attempts')}
        >
          Attempts ({attempts.length})
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${view === 'redemptions' ? styles.tabActive : ''}`}
          onClick={() => setView('redemptions')}
        >
          Redemptions ({redemptions.length})
        </button>
      </div>

      {view === 'attempts' ? (
        <div className={styles.card} style={{ marginTop: 12 }}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Offer</th>
                  <th>Outcome</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Discount</th>
                  <th>Note</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className={styles.mutedCell}>
                      Loading…
                    </td>
                  </tr>
                )}

                {!loading && attempts.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.mutedCell}>
                      No attempts found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  attempts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <div className={styles.cellMain}>{fmtDateTime(a.createdAt)}</div>
                        <div className={styles.cellSub}>{a.id.slice(0, 8)}…</div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{a.offerName ?? '—'}</div>
                        <div className={styles.cellSub}>
                          {a.offerId ? a.offerId.slice(0, 8) + '…' : '—'}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`${styles.pill} ${
                            a.outcome === 'REJECTED'
                              ? styles.pillExpired
                              : a.redeemedOnOrder
                                ? styles.pillActive
                                : styles.pillPaused
                          }`}
                        >
                          {a.outcome === 'REJECTED'
                            ? 'Rejected'
                            : a.redeemedOnOrder
                              ? 'Redeemed'
                              : 'Applied'}
                        </span>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{a.email ?? '—'}</div>
                        <div className={styles.cellSub}>
                          {a.userId ? `User ${a.userId.slice(0, 8)}…` : 'Guest'}
                        </div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{a.orderDisplayId ?? '—'}</div>
                        <div className={styles.cellSub}>
                          {a.orderPaymentStatus ?? a.orderStatus ?? '—'}
                        </div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>
                          -{penceToGBP((a.discountPence ?? 0) + (a.shippingDiscountPence ?? 0))}
                        </div>
                        <div className={styles.cellSub}>
                          Sub {a.subtotalPence != null ? penceToGBP(a.subtotalPence) : '—'} • Ship{' '}
                          {a.shippingPence != null ? penceToGBP(a.shippingPence) : '—'}
                        </div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{a.offerName ?? '—'}</div>
                        <div className={styles.cellSub}>
                          {a.errorCode ?? (a.outcome === 'REJECTED' ? 'Invalid/blocked' : '—')}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className={styles.card} style={{ marginTop: 12 }}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Offer</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th>Discount</th>
                  <th>Status</th>
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

                {!loading && redemptions.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.mutedCell}>
                      No redemptions found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  redemptions.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className={styles.cellMain}>{fmtDateTime(r.createdAt)}</div>
                        <div className={styles.cellSub}>{r.id.slice(0, 8)}…</div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{r.offerName ?? '—'}</div>
                        <div className={styles.cellSub}>{r.offerId.slice(0, 8)}…</div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{r.email ?? '—'}</div>
                        <div className={styles.cellSub}>
                          {r.userId ? `User ${r.userId.slice(0, 8)}…` : 'Guest'}
                        </div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>{r.orderDisplayId ?? '—'}</div>
                        <div className={styles.cellSub}>{r.orderId.slice(0, 8)}…</div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>
                          -{penceToGBP((r.discountPence ?? 0) + (r.shippingDiscountPence ?? 0))}
                        </div>
                      </td>

                      <td>
                        <div className={styles.cellMain}>
                          {r.orderPaymentStatus ?? r.orderStatus ?? '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
