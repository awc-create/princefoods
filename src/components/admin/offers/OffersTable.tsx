// src/components/admin/offers/OffersTable.tsx
'use client';

import type { OfferAdminForm } from '@/types/offers';
import styles from './offers.module.scss';
import { fmtDate, offerLabel } from './utils';

type OfferRow = OfferAdminForm & { id: string }; // ✅ id guaranteed

function statusPill(status: OfferAdminForm['status']) {
  const cls =
    status === 'ACTIVE'
      ? styles.statusActive
      : status === 'PAUSED'
        ? styles.statusPaused
        : styles.statusOther;

  return <span className={`${styles.statusPill} ${cls}`}>{status}</span>;
}

export default function OffersTable({
  rows,
  onEdit,
  onToggle,
  onDelete
}: {
  rows: OfferRow[];
  onEdit: (id: string) => void;
  onToggle: (o: OfferRow) => void;
  onDelete: (o: OfferRow) => void;
}) {
  return (
    <div className={styles.offersTableWrap}>
      <table className={styles.offersTable}>
        <thead>
          <tr>
            <th className={styles.colName}>Name</th>
            <th className={styles.colRule}>Rule</th>
            <th className={styles.colStatus}>Status</th>
            <th className={styles.colWindow}>Window</th>
            <th className={styles.colActions}></th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.tableEmpty}>
                No offers found.
              </td>
            </tr>
          ) : (
            rows.map((o) => {
              const id = o.id;
              const windowText = `${fmtDate(o.startsAt ?? null)} → ${fmtDate(o.endsAt ?? null)}`;

              return (
                <tr key={id} className={styles.offerRow}>
                  <td className={styles.nameCell}>
                    <div className={styles.nameMain}>{o.name}</div>
                    <div className={styles.nameSub}>ID: {id}</div>
                  </td>

                  <td className={styles.ruleCell}>
                    <span className={styles.rulePill}>{offerLabel(o)}</span>
                  </td>

                  <td className={styles.statusCell}>{statusPill(o.status)}</td>

                  <td className={styles.windowCell}>
                    <span className={styles.windowPill}>{windowText}</span>
                  </td>

                  <td className={styles.actionsCell}>
                    <div className={styles.actions}>
                      <button type="button" className={styles.actionBtn} onClick={() => onEdit(id)}>
                        Edit
                      </button>

                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => onToggle(o)}
                      >
                        {o.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>

                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.dangerBtn}`}
                        onClick={() => onDelete(o)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
