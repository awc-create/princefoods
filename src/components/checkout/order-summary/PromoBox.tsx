'use client';

import { useCallback } from 'react';
import styles from '../OrderSummary.module.scss';

export default function PromoBox({
  promo,
  setPromo,
  status,
  onApply,
  onClear,
  disabled
}: {
  promo: string;
  setPromo: (v: string) => void;
  status: 'idle' | 'checking' | 'applied' | 'error';
  onApply: () => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (status !== 'checking') onApply();
      }
    },
    [onApply, status]
  );

  return (
    <div className={styles.promoRow}>
      <input
        className={styles.promoInput}
        placeholder="Promo code"
        value={promo}
        onChange={(e) => setPromo(e.target.value)}
        onKeyDown={onKeyDown}
      />

      {status === 'applied' ? (
        <button type="button" className={styles.promoBtn} onClick={onClear} title="Remove promo">
          Remove
        </button>
      ) : (
        <button
          type="button"
          className={styles.promoBtn}
          onClick={onApply}
          disabled={disabled || status === 'checking'}
          title="Apply promo"
        >
          {status === 'checking' ? 'Checking…' : 'Apply'}
        </button>
      )}
    </div>
  );
}
