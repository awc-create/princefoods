// src/components/admin/orders/apc/ApcProductCodeSelect.tsx
'use client';

interface Option {
  code: string;
  label: string;
  meta?: string;
}

export default function ApcProductCodeSelect({
  options,
  value,
  onChange,
  disabled
}: {
  options: Option[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontWeight: 650 }}>Service (APC Product Code)</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{ height: 42, borderRadius: 10, padding: '0 12px' }}
      >
        <option value="" disabled>
          Select a service…
        </option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
            {o.meta ? ` — ${o.meta}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}
