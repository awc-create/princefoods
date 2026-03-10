// src/components/admin/customer-discounts/EditCustomerDiscountModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './customer-discounts.module.scss';
import type { CustomerDiscountRow, PatchBody } from './types';
import { clampInt, isoToDateInput, toIntOrNull } from './utils';

export default function EditCustomerDiscountModal({
  open,
  onClose,
  row,
  onSave,
  saving,
  error
}: {
  open: boolean;
  onClose: () => void;
  row: CustomerDiscountRow | null;
  onSave: (id: string, patch: PatchBody) => void;
  saving: boolean;
  error: string | null;
}) {
  const dialogBodyRef = useRef<HTMLDivElement | null>(null);

  const [percentOff, setPercentOff] = useState('10');
  const [applyShipping, setApplyShipping] = useState(false);

  const initialShipPct = useMemo(() => {
    const d = row?.shippingPercentOffDry;
    const f = row?.shippingPercentOffFrozen;
    const best = typeof d === 'number' ? d : typeof f === 'number' ? f : 100;
    return String(clampInt(best, 0, 100));
  }, [row?.shippingPercentOffDry, row?.shippingPercentOffFrozen]);

  const [shippingPct, setShippingPct] = useState(initialShipPct);

  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [noEnd, setNoEnd] = useState(true);
  const [note, setNote] = useState('');

  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;

    setPercentOff(String(row.percentOff ?? 10));
    setApplyShipping(row.applyShippingDiscount === true);
    setShippingPct(initialShipPct);

    setStartsAt(isoToDateInput(row.startsAt));
    setEndsAt(isoToDateInput(row.endsAt));
    setNoEnd(!row.endsAt);

    setNote(row.note ?? '');
    setLocalErr(null);

    window.setTimeout(() => dialogBodyRef.current?.scrollTo({ top: 0 }), 0);
  }, [open, row, initialShipPct]);

  if (!open || !row) return null;

  function submit() {
    if (!row) return; // ✅ extra guard to satisfy TS in all cases
    setLocalErr(null);

    const pct = toIntOrNull(percentOff);
    if (pct == null) return setLocalErr('Enter a valid percent.');
    const pctClamped = clampInt(pct, 1, 100);

    const shipPctInt = toIntOrNull(shippingPct);
    const shipPctClamped = shipPctInt == null ? 0 : clampInt(shipPctInt, 0, 100);

    const patch: PatchBody = {
      percentOff: pctClamped,

      applyShippingDiscount: applyShipping,
      shippingPercentOffDry: applyShipping ? shipPctClamped : null,
      shippingPercentOffFrozen: applyShipping ? shipPctClamped : null,

      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: noEnd ? null : endsAt ? new Date(endsAt).toISOString() : null,

      note: note.trim() ? note.trim() : null
    };

    onSave(row.id, patch);
  }

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>Edit customer discount</div>
            <div className={styles.modalSub}>{row?.userEmail ?? ''}</div>
          </div>

          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody} ref={dialogBodyRef}>
          <div className={styles.formGrid}>
            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Percent off</label>
                <div className={styles.pillInput}>
                  <span className={styles.pillIcon}>%</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    value={percentOff}
                    onChange={(e) => setPercentOff(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Note</label>
                <input
                  className={styles.input}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.split2}>
              <div className={styles.field}>
                <label className={styles.label}>Shipping discount</label>
                <label className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={applyShipping}
                    onChange={(e) => setApplyShipping(e.target.checked)}
                  />
                  <span>
                    <strong>Apply shipping discount</strong>
                    <div className={styles.hint}>Optional. Set to 100% for free shipping.</div>
                  </span>
                </label>
              </div>

              <div className={styles.field}>
                <label className={styles.label} style={{ opacity: applyShipping ? 1 : 0.45 }}>
                  Shipping % (0–100)
                </label>
                <div className={styles.pillInput} style={{ opacity: applyShipping ? 1 : 0.45 }}>
                  <span className={styles.pillIcon}>%</span>
                  <input
                    className={styles.input}
                    inputMode="numeric"
                    disabled={!applyShipping}
                    value={shippingPct}
                    onChange={(e) => setShippingPct(e.target.value)}
                  />
                </div>
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
                  <input
                    type="checkbox"
                    checked={noEnd}
                    onChange={(e) => setNoEnd(e.target.checked)}
                  />
                  <span>No end date</span>
                </label>
              </div>
            </div>
          </div>

          {(localErr ?? error) && <div className={styles.inlineError}>{localErr ?? error}</div>}
        </div>

        <div className={styles.modalFooter}>
          <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className={styles.primaryBtn} onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
