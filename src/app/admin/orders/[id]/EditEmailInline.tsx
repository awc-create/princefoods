'use client';

import { useEffect, useRef, useState } from 'react';

export default function EditEmailInline({
  orderId,
  initial
}: {
  orderId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [savedValue, setSavedValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [okTick, setOkTick] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    // keep in sync if parent re-renders with a different initial
    setValue(initial);
    setSavedValue(initial);
  }, [initial]);

  async function save(next: string) {
    if (next === savedValue) return;
    setSaving(true);
    setError(null);

    // optimistic UI: update the savedValue immediately
    const prev = savedValue;
    setSavedValue(next);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: next })
      });
      const j = (await res.json()) as { ok?: boolean; error?: string; email?: string };
      if (!res.ok || j?.ok === false) {
        throw new Error(j?.error ?? res.statusText);
      }
      // server may normalize case/trim; keep what it says if provided
      if (j.email) {
        setValue(j.email);
        setSavedValue(j.email);
      }
      setOkTick(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setOkTick(false), 1200);
    } catch (e) {
      // rollback optimistic change
      setSavedValue(prev);
      setValue(prev);
      setError(e instanceof Error ? e.message : 'Failed to save email');
    } finally {
      setSaving(false);
    }
  }

  function onBlur() {
    const next = value.trim();
    if (next !== savedValue) void save(next);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      setValue(savedValue);
      e.currentTarget.blur();
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        style={{
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid #ddd',
          minWidth: 260
        }}
        title="Edit customer email and press Enter (or click away) to save"
      />
      {saving && <span style={{ color: '#666', fontSize: 12 }}>Saving…</span>}
      {okTick && !saving && <span style={{ color: '#0a7', fontSize: 12 }}>Saved ✓</span>}
      {error && (
        <span style={{ color: '#b00020', fontSize: 12 }} title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
