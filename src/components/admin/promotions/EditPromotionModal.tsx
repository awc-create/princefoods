// src/components/admin/promotions/EditPromotionModal.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MultiPicker from './MultiPicker';
import styles from './promotions.module.scss';
import type { PickerOption, PromotionDetail, PromotionPatch, PromotionStatus } from './types';
import { clampInt, isoToDateInput, toIntOrNull } from './utils';

type CustomerMode = 'ALL' | 'USERS';

export default function EditPromotionModal({
  id,
  open,
  onClose,
  onLoad,
  loading,
  error,
  promotion,
  onSave,
  customerOptions,
  optionsLoading,
  optionsError,
  onRequestOptions
}: {
  id: string | null;
  open: boolean;
  onClose: () => void;

  onLoad: (id: string) => void;
  loading: boolean;
  error: string | null;
  promotion: PromotionDetail | null;

  onSave: (id: string, patch: PromotionPatch) => void;

  customerOptions: PickerOption[];
  optionsLoading: boolean;
  optionsError: string | null;
  onRequestOptions: () => void;
}) {
  const dialogBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    onRequestOptions();
    window.setTimeout(() => dialogBodyRef.current?.scrollTo({ top: 0 }), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
            <div className={styles.modalSub}>{promotion?.code ?? 'AUTO'}</div>
          </div>

          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.modalBody} ref={dialogBodyRef}>
          {loading && <div className={styles.mutedCell}>Loading…</div>}
          {error && <div className={styles.inlineError}>{error}</div>}
          {!loading && promotion && (
            <EditPromoForm
              promo={promotion}
              onCancel={onClose}
              onSave={(patch) => onSave(promotion.id, patch)}
              customerOptions={customerOptions}
              optionsLoading={optionsLoading}
              optionsError={optionsError}
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
  onSave,
  customerOptions,
  optionsLoading,
  optionsError
}: {
  promo: PromotionDetail;
  onCancel: () => void;
  onSave: (patch: PromotionPatch) => void;

  customerOptions: PickerOption[];
  optionsLoading: boolean;
  optionsError: string | null;
}) {
  const isCustomerDiscount = promo.applyMode === 'AUTO' && promo.discountType === 'PERCENT';

  const [name, setName] = useState<string>(promo.name ?? '');
  const [status, setStatus] = useState<PromotionStatus>(promo.status ?? 'ACTIVE');
  const [startsAt, setStartsAt] = useState<string>(isoToDateInput(promo.startsAt));
  const [endsAt, setEndsAt] = useState<string>(isoToDateInput(promo.endsAt));
  const [noEnd, setNoEnd] = useState<boolean>(!promo.endsAt);

  // customer discount % (only shown for AUTO customer discounts)
  const [percentOff, setPercentOff] = useState<string>(
    String(clampInt(promo.percentOff ?? 10, 1, 100))
  );

  // shipping controls
  const [applyShipping, setApplyShipping] = useState<boolean>(promo.applyShippingDiscount === true);

  const initialShipPct = useMemo(() => {
    const d = promo.shippingPercentOffDry;
    const f = promo.shippingPercentOffFrozen;
    const best = typeof d === 'number' ? d : typeof f === 'number' ? f : 0;
    return String(clampInt(best, 0, 100));
  }, [promo.shippingPercentOffDry, promo.shippingPercentOffFrozen]);

  const [shippingPct, setShippingPct] = useState<string>(initialShipPct);

  // eligibility
  const initialMode: CustomerMode =
    promo.eligibleCustomerScope ?? (promo.eligibleUserIds?.length ? 'USERS' : 'ALL');
  const [customerMode, setCustomerMode] = useState<CustomerMode>(initialMode);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>(
    promo.eligibleUserIds ?? []
  );

  useEffect(() => {
    if (customerMode === 'ALL') setSelectedCustomerIds([]);
  }, [customerMode]);

  const showCustomerPicker = isCustomerDiscount ? true : customerMode === 'USERS';

  const [localErr, setLocalErr] = useState<string | null>(null);

  const save = () => {
    setLocalErr(null);

    // customer discounts must have selected customers
    if (isCustomerDiscount) {
      if (selectedCustomerIds.length === 0) {
        setLocalErr('Select at least 1 customer.');
        return;
      }
    } else {
      if (customerMode === 'USERS' && selectedCustomerIds.length === 0) {
        setLocalErr('Select at least 1 customer.');
        return;
      }
    }

    const shipPctInt = toIntOrNull(shippingPct);
    const shipPctClamped = shipPctInt == null ? 0 : clampInt(shipPctInt, 0, 100);

    const pctInt = toIntOrNull(percentOff);
    const pctClamped = pctInt == null ? null : clampInt(pctInt, 1, 100);

    onSave({
      name: name.trim(),
      status,
      startsAt: startsAt ? new Date(startsAt).toISOString() : null,
      endsAt: noEnd ? null : endsAt ? new Date(endsAt).toISOString() : null,

      // eligibility
      eligibleCustomerScope: isCustomerDiscount ? 'USERS' : customerMode,
      eligibleUserIds: dedupeSelected(
        isCustomerDiscount ? selectedCustomerIds : selectedCustomerIds,
        isCustomerDiscount ? 'USERS' : customerMode
      ),

      // customer discount value
      ...(isCustomerDiscount && pctClamped != null ? { percentOff: pctClamped } : {}),

      // shipping
      applyShippingDiscount: applyShipping,
      shippingPercentOffDry: applyShipping ? shipPctClamped : null,
      shippingPercentOffFrozen: applyShipping ? shipPctClamped : null
    });
  };

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

        {isCustomerDiscount && (
          <div className={styles.cardInset} style={{ padding: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Customer discount</div>
            <div className={styles.hint}>
              Auto-applied % discount for selected customers during the date window.
            </div>
          </div>
        )}

        {isCustomerDiscount && (
          <div className={styles.field}>
            <label className={styles.label}>Discount %</label>
            <div className={styles.pillInput}>
              <span className={styles.pillIcon}>%</span>
              <input
                className={styles.input}
                inputMode="numeric"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
              />
            </div>
            <div className={styles.hint}>1–100%</div>
          </div>
        )}

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
                <div className={styles.hint}>Set to 100% for free shipping.</div>
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
            <label className={styles.label}>Eligible customers</label>
            <select
              className={styles.select}
              value={isCustomerDiscount ? 'USERS' : customerMode}
              onChange={(e) => setCustomerMode(e.target.value as CustomerMode)}
              disabled={isCustomerDiscount}
            >
              <option value="ALL">All customers</option>
              <option value="USERS">Selected customers</option>
            </select>
            <div className={styles.hint}>
              {isCustomerDiscount
                ? 'Customer discounts require selected customers.'
                : 'Optional allow-list.'}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} style={{ opacity: showCustomerPicker ? 1 : 0.45 }}>
              &nbsp;
            </label>
            <div className={styles.hint} style={{ opacity: showCustomerPicker ? 1 : 0.45 }}>
              {showCustomerPicker ? 'Pick customers below.' : 'No customer restrictions.'}
            </div>
          </div>
        </div>

        {showCustomerPicker && (
          <div className={styles.cardInset}>
            {optionsError && <div className={styles.inlineError}>{optionsError}</div>}
            {optionsLoading && (
              <div className={styles.mutedCell} style={{ padding: 10 }}>
                Loading customers…
              </div>
            )}

            {!optionsLoading && (
              <MultiPicker
                title="Select customers"
                placeholder="Search customers (name/email)…"
                options={customerOptions}
                selectedIds={selectedCustomerIds}
                onChange={setSelectedCustomerIds}
              />
            )}
          </div>
        )}
      </div>

      {localErr && <div className={styles.inlineError}>{localErr}</div>}

      <div className={styles.modalFooter}>
        <button type="button" className={styles.secondaryBtn} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={styles.primaryBtn} onClick={save}>
          Save
        </button>
      </div>
    </>
  );
}

function dedupeSelected(ids: string[], mode: CustomerMode) {
  if (mode === 'ALL') return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const k = (id ?? '').trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}
