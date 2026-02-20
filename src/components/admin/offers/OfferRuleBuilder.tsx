'use client';

import styles from './offers.module.scss';
import type { AdminOfferKind } from './types';

function clampInt(n: number, min: number, max: number) {
  const v = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, v));
}

function poundsToPence(raw: string): number {
  // allow "1", "1.2", "1.20"
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function penceToPounds(pence: number | null | undefined): string {
  const v = Number.isFinite(pence as number) ? (pence as number) : 0;
  return (v / 100).toFixed(2);
}

export default function OfferRuleBuilder({
  kind,
  buyQty,
  setBuyQty,

  getQty,
  setGetQty,

  payQty,
  setPayQty,

  pricePence,
  setPricePence,

  percent,
  setPercent
}: {
  kind: AdminOfferKind;

  // used by BOGOF, X_FOR_Y, X_FOR_FIXED_PRICE
  buyQty: number;
  setBuyQty: (v: number) => void;

  // BOGOF only
  getQty: number | null;
  setGetQty: (v: number | null) => void;

  // X_FOR_Y only
  payQty: number | null;
  setPayQty: (v: number | null) => void;

  // X_FOR_FIXED_PRICE and AMOUNT_OFF
  pricePence: number | null;
  setPricePence: (v: number | null) => void;

  // PERCENT_OFF
  percent: number | null;
  setPercent: (v: number | null) => void;
}) {
  // --- Percent off ---
  if (kind === 'PERCENT_OFF') {
    return (
      <div className={styles.split2}>
        <div className={styles.field}>
          <label className={styles.label}>Percent off</label>
          <input
            className={styles.input}
            type="number"
            min={0}
            max={100}
            value={percent ?? 0}
            onChange={(e) => setPercent(clampInt(Number(e.target.value), 0, 100))}
          />
          <div className={styles.hint} style={{ marginTop: 6 }}>
            Example: “10% off” → percent 10
          </div>
        </div>
      </div>
    );
  }

  // --- Amount off ---
  if (kind === 'AMOUNT_OFF') {
    return (
      <div className={styles.split2}>
        <div className={styles.field}>
          <label className={styles.label}>Amount off</label>

          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8 }}>
            <div
              className={styles.input}
              style={{ display: 'grid', placeItems: 'center', padding: 0, opacity: 0.9 }}
              aria-hidden
            >
              £
            </div>

            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={penceToPounds(pricePence)}
              onChange={(e) => setPricePence(poundsToPence(e.target.value))}
            />
          </div>

          <div className={styles.hint} style={{ marginTop: 6 }}>
            Example: “£2 off” → amount £2.00
          </div>
        </div>
      </div>
    );
  }

  // --- The 3 original kinds ---
  return (
    <div className={styles.split2}>
      <div className={styles.field}>
        <label className={styles.label}>
          {kind === 'X_FOR_FIXED_PRICE' ? 'Quantity (X)' : 'Buy quantity'}
        </label>
        <input
          className={styles.input}
          type="number"
          min={1}
          value={buyQty}
          onChange={(e) => setBuyQty(clampInt(Number(e.target.value), 1, 999))}
        />
      </div>

      {kind === 'BOGOF' && (
        <div className={styles.field}>
          <label className={styles.label}>Get free</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={getQty ?? 1}
            onChange={(e) => setGetQty(clampInt(Number(e.target.value), 1, 999))}
          />
        </div>
      )}

      {kind === 'X_FOR_Y' && (
        <div className={styles.field}>
          <label className={styles.label}>Pay for (Y)</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            value={payQty ?? 1}
            onChange={(e) => setPayQty(clampInt(Number(e.target.value), 1, 999))}
          />
        </div>
      )}

      {kind === 'X_FOR_FIXED_PRICE' && (
        <div className={styles.field}>
          <label className={styles.label}>Fixed price (total)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 8 }}>
            <div
              className={styles.input}
              style={{ display: 'grid', placeItems: 'center', padding: 0, opacity: 0.9 }}
              aria-hidden
            >
              £
            </div>
            <input
              className={styles.input}
              type="number"
              min={0}
              step="0.01"
              value={penceToPounds(pricePence)}
              onChange={(e) => setPricePence(poundsToPence(e.target.value))}
            />
          </div>

          <div className={styles.hint} style={{ marginTop: 6 }}>
            Example: “2 for £1” → quantity 2, fixed price £1.00
          </div>
        </div>
      )}
    </div>
  );
}
