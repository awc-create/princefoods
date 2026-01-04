// src/components/checkout/Field.tsx
'use client';

import styles from '@/app/checkout/checkout.module.scss';
import React, { useMemo } from 'react';

export default function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  invalid = false,
  hint,
  onBlur
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  invalid?: boolean;
  hint?: string;
  onBlur?: () => void;
}) {
  const id = useMemo(() => `f_${label.toLowerCase().replace(/\s+/g, '_')}`, [label]);

  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        id={id}
        value={value}
        type={type}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
      {!hint && <span className={styles.hint} aria-hidden="true" />}
    </label>
  );
}
