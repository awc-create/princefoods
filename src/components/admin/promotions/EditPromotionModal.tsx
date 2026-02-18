'use client';

import { useEffect, useState } from 'react';
import styles from './promotions.module.scss';
import type { PromotionDetail, PromotionPatch, PromotionStatus } from './types';
import { isoToDateInput } from './utils';

export default function EditPromotionModal({
  id,
  open,
  onClose,
  onLoad,
  loading,
  error,
  promotion,
  onSave
}: {
  id: string | null;
  open: boolean;
  onClose: () => void;

  onLoad: (id: string) => void;
  loading: boolean;
  error: string | null;
  promotion: PromotionDetail | null;

  onSave: (id: string, patch: PromotionPatch) => void;
}) {
  useEffect(() => {
    if (!open || !id) return;
    onLoad(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  if (!open || !id) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Edit promotion</div>
            <div className={styles.modalSub}>{promotion?.code ?? ''}</div>
          </div>

          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading && <div className={styles.mutedCell}>Loading…</div>}
          {error && <div className={styles.inlineError}>{error}</div>}
          {!loading && promotion && (
            <EditPromoForm
              promo={promotion}
              onCancel={onClose}
              onSave={(patch) => onSave(promotion.id, patch)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function EditPromoForm({
  promo,
  onCancel,
  onSave
}: {
  promo: PromotionDetail;
  onCancel: () => void;
  onSave: (patch: PromotionPatch) => void;
}) {
  const [name, setName] = useState<string>(promo.name ?? '');
  const [status, setStatus] = useState<PromotionStatus>(promo.status ?? 'ACTIVE');
  const [startsAt, setStartsAt] = useState<string>(isoToDateInput(promo.startsAt));
  const [endsAt, setEndsAt] = useState<string>(isoToDateInput(promo.endsAt));
  const [noEnd, setNoEnd] = useState<boolean>(!promo.endsAt);

  return (
    <>
      <div className={styles.formGrid}>
        <div className={styles.split2}>
          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Status</label>
            <select
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as PromotionStatus)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="EXPIRED">EXPIRED</option>
            </select>
          </div>
        </div>

        <div className={styles.split2}>
          <div className={styles.field}>
            <label className={styles.label}>Starts</label>
            <input
              className={styles.input}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Ends</label>
            <input
              className={styles.input}
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              disabled={noEnd}
            />
            <label className={styles.checkInline}>
              <input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.target.checked)} />
              <span>No end date</span>
            </label>
          </div>
        </div>
      </div>

      <div className={styles.modalFooter}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={() =>
            onSave({
              name: name.trim(),
              status,
              startsAt: startsAt ? new Date(startsAt).toISOString() : null,
              endsAt: noEnd ? null : endsAt ? new Date(endsAt).toISOString() : null
            })
          }
        >
          Save
        </button>
      </div>
    </>
  );
}
