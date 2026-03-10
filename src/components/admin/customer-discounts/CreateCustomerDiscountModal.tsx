// src/components/admin/customer-discounts/CreateCustomerDiscountModal.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './customer-discounts.module.scss';

import MultiPicker from '../promotions/MultiPicker';
import type { CreateBody, PickerOption } from './types';
import { clampInt, toIntOrNull } from './utils';

export default function CreateCustomerDiscountModal({
  open,
  onClose,
  customerOptions,
  optionsLoading,
  optionsError,
  onRequestOptions,
  onCreate,
  creating,
  createError
}: {
  open: boolean;
  onClose: () => void;

  customerOptions: PickerOption[];
  optionsLoading: boolean;
  optionsError: string | null;
  onRequestOptions: (q?: string) => void;

  onCreate: (body: CreateBody) => void;
  creating: boolean;
  createError: string | null;
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [percentOff, setPercentOff] = useState('10');

  const [applyShipping, setApplyShipping] = useState(false);
  const [shippingPct, setShippingPct] = useState('100');

  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [noEnd, setNoEnd] = useState(true);

  const [note, setNote] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  const shipPctClamped = useMemo(() => {
    const n = toIntOrNull(shippingPct);
    return n == null ? 0 : clampInt(n, 0, 100);
  }, [shippingPct]);

  useEffect(() => {
    if (!open) return;

    setSelectedUserIds([]);
    setPercentOff('10');
    setApplyShipping(false);
    setShippingPct('100');
    setStartsAt('');
    setEndsAt('');
    setNoEnd(true);
    setNote('');
    setLocalErr(null);

    // ✅ load initial list
    onRequestOptions('');
    // ❌ REMOVE scrollTo – this is what causes visible "bouncing"
  }, [open, onRequestOptions]);

  function submit() {
    setLocalErr(null);

    if (selectedUserIds.length === 0) return setLocalErr('Select at least 1 customer.');

    const pct = toIntOrNull(percentOff);
    if (pct == null) return setLocalErr('Enter a valid percent.');

    const pctClamped = clampInt(pct, 1, 100);

    const body: CreateBody = {
      userIds: selectedUserIds,
      percentOff: pctClamped,

      applyShippingDiscount: applyShipping,
      shippingPercentOffDry: applyShipping ? shipPctClamped : null,
      shippingPercentOffFrozen: applyShipping ? shipPctClamped : null,

      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: noEnd ? null : endsAt ? new Date(endsAt).toISOString() : null,

      note: note.trim() ? note.trim() : null
    };

    onCreate(body);
  }

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <div>
            <div className={styles.modalTitle}>New customer discount</div>
            <div className={styles.modalSub}>
              Create a percent discount for selected customers (history is kept).
            </div>
          </div>

          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.cardInset}>
            <MultiPicker
              title="Select customers"
              placeholder="Search customers (name/email)…"
              options={customerOptions}
              selectedIds={selectedUserIds}
              onChange={setSelectedUserIds}
              remote
              minChars={0}
              onRemoteSearch={(q) => onRequestOptions(q)}
              remoteLoading={optionsLoading}
              remoteError={optionsError}
            />
          </div>

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
                    <strong>Add shipping discount</strong>
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
          </div>

          {(localErr ?? createError) && (
            <div className={styles.inlineError}>{localErr ?? createError}</div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onClose}
            disabled={creating}
          >
            Cancel
          </button>
          <button type="button" className={styles.primaryBtn} onClick={submit} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
