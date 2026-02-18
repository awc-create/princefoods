'use client';

import styles from './promotions.module.scss';
import type { PromotionRow, PromotionStatus } from './types';
import { discountLabel, fmtDate, statusPillClass, targetLabel } from './utils';

export default function PromotionsTable({
  rows,
  loading,
  onEdit,
  onTogglePause,
  onDelete
}: {
  rows: PromotionRow[];
  loading: boolean;
  onEdit: (id: string) => void;
  onTogglePause: (p: PromotionRow) => void;
  onDelete: (p: PromotionRow) => void;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Discount</th>
            <th>Type</th>
            <th>Code</th>
            <th>Status</th>
            <th>Window</th>
            <th>Target</th>
            <th>Usage</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading && (
            <tr>
              <td colSpan={9} className={styles.mutedCell}>
                Loading…
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={9} className={styles.mutedCell}>
                No promotions found.
              </td>
            </tr>
          )}

          {!loading &&
            rows.map((p) => (
              <tr key={p.id}>
                <td className={styles.nameCell}>
                  <div className={styles.nameMain}>{p.name}</div>
                  <div className={styles.nameSub}>
                    Updated {fmtDate(p.updatedAt)} • Created {fmtDate(p.createdAt)}
                  </div>
                </td>

                <td>
                  <div className={styles.cellMain}>{discountLabel(p)}</div>
                  {p.applyShippingDiscount && (
                    <div className={styles.cellSub}>
                      + Shipping {p.shippingPercentOffDry ?? 0}% off
                    </div>
                  )}
                </td>

                <td>
                  <div className={styles.cellMain}>{p.type}</div>
                  <div className={styles.cellSub}>{p.discountType}</div>
                </td>

                <td className={styles.codeCell}>{p.code}</td>

                <td>
                  <span
                    className={`${styles.pill} ${statusPillClass(p.status as PromotionStatus, styles)}`}
                  >
                    {p.status}
                  </span>
                </td>

                <td>
                  <div className={styles.cellMain}>
                    {p.startsAt ? fmtDate(p.startsAt) : 'Any time'}
                  </div>
                  <div className={styles.cellSub}>{p.endsAt ? fmtDate(p.endsAt) : 'No end'}</div>
                </td>

                <td>
                  <div className={styles.cellMain}>{targetLabel(p)}</div>
                </td>

                <td>
                  <div className={styles.cellMain}>
                    {p.redemptionCount}
                    {p.maxUsesTotal ? ` / ${p.maxUsesTotal}` : ''}
                  </div>
                  <div className={styles.cellSub}>Redemptions</div>
                </td>

                <td className={styles.actionsCell}>
                  <button type="button" className={styles.rowBtn} onClick={() => onEdit(p.id)}>
                    Edit
                  </button>

                  <button
                    type="button"
                    className={styles.rowBtn}
                    onClick={() => onTogglePause(p)}
                    title={p.status === 'ACTIVE' ? 'Pause this promo' : 'Resume this promo'}
                  >
                    {p.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                  </button>

                  <button type="button" className={styles.rowBtnDanger} onClick={() => onDelete(p)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
