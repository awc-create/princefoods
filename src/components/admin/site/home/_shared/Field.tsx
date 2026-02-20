// src/components/admin/site/home/_shared/Field.tsx
import type React from 'react';
import s from './Field.module.scss';

export default function Field({
  label,
  children,
  help
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className={s.field}>
      <span className={s.label}>{label}</span>
      {children}
      {help && <span className={s.help}>{help}</span>}
    </label>
  );
}
