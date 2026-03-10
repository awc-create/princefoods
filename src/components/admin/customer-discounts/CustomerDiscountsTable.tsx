// src/components/admin/customer-discounts/CustomerDiscountsTable.tsx
'use client';

import styles from './customer-discounts.module.scss';
import type { CustomerDiscountRow, DiscountStatus } from './types';
import { fmtDate, fmtDateTime, statusLabel } from './utils';

function statusClass(s: DiscountStatus) {
  if (s === 'ACTIVE') return styles.pillActive;
  if (s === 'UPCOMING') return styles.pillUpcoming;
  return styles.pillExpired;
}

export default function CustomerDiscountsTable({
  rows,
  loading,
  onEdit,
  onStopNow,
  onDelete
}: {
  rows: CustomerDiscountRow[];
  loading: boolean;
  onEdit: (id: string) => void;
  onStopNow: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>% off</th>
            <th>Shipping</th>
            <th>Window</th>
            <th>Note</th>
            <th>Status</th>
            <th>Created</th>
            <th style={{ width: 220 }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className={styles.mutedCell}>
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className={styles.mutedCell}>
                No customer discounts yet.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 700 }}>{r.userLabel}</div>
                  <div className={styles.subtle}>{r.userEmail}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{r.percentOff}%</td>
                <td>
                  {r.applyShippingDiscount
                    ? `${r.shippingPercentOffDry ?? r.shippingPercentOffFrozen ?? 0}%`
                    : '—'}
                </td>
                <td>
                  {fmtDate(r.startsAt)} → {fmtDate(r.endsAt)}
                </td>
                <td>{r.note ?? '—'}</td>
                <td>
                  <span className={`${styles.pill} ${statusClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className={styles.subtle}>{fmtDateTime(r.createdAt)}</td>
                <td>
                  <div className={styles.rowActions}>
                    <button
                      type="button"
                      className={styles.secondaryBtnSm}
                      onClick={() => onEdit(r.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.secondaryBtnSm}
                      onClick={() => onStopNow(r.id)}
                      title="Sets endsAt = today"
                    >
                      Stop now
                    </button>
                    <button
                      type="button"
                      className={styles.dangerBtnSm}
                      onClick={() => onDelete(r.id)}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
