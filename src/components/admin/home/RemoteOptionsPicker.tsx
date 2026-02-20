// src/components/admin/home/RemoteOptionsPicker.tsx
'use client';

import { urlFrom } from '@/lib/url';
import { useEffect, useMemo, useState } from 'react';
import s from './RemoteOptionsPicker.module.scss';

export interface OptionItem {
  id: string;
  label: string;
  meta?: string;
}

export function RemoteOptionsPicker({
  label,
  placeholder,
  endpoint,
  value,
  onChange,
  multiple = false
}: {
  label: string;
  placeholder?: string;
  endpoint: string;
  value: string | string[] | null | undefined;
  onChange: (next: string | string[] | null) => void;
  multiple?: boolean;
}) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Cache labels for selected chips even if user searches away
  const [cache, setCache] = useState<Record<string, OptionItem>>({});

  const selected = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value.filter(Boolean) : [];
    return typeof value === 'string' && value ? [value] : [];
  }, [value, multiple]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    let mounted = true;
    const ctrl = new AbortController();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = urlFrom(endpoint);
        if (q.trim()) url.searchParams.set('q', q.trim());

        const res = await fetch(url.toString(), { signal: ctrl.signal, cache: 'no-store' });
        const json = (await res.json()) as { options?: OptionItem[]; error?: string };

        if (!mounted) return;

        const nextOptions = Array.isArray(json.options) ? json.options : [];
        setOptions(nextOptions);

        // merge into cache
        if (nextOptions.length) {
          setCache((prev) => {
            const next = { ...prev };
            for (const o of nextOptions) next[o.id] = o;
            return next;
          });
        }

        if (json.error) setError(json.error);
      } catch (e) {
        if (!mounted) return;
        if (e instanceof DOMException && e.name === 'AbortError') return;
        setError('Failed to load options');
        setOptions([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      ctrl.abort();
    };
  }, [endpoint, q]);

  const toggle = (id: string) => {
    if (!multiple) {
      onChange(id);
      return;
    }

    const cur = Array.isArray(value) ? value : [];
    const next = new Set(cur);

    if (next.has(id)) next.delete(id);
    else next.add(id);

    onChange(Array.from(next));
  };

  const removeChip = (id: string) => {
    if (!multiple) {
      onChange(null);
      return;
    }
    const cur = Array.isArray(value) ? value : [];
    onChange(cur.filter((x) => x !== id));
  };

  const clear = () => onChange(multiple ? [] : null);

  // TEMP DEBUG: shows the true prop value this component is receiving
  const debugValue = useMemo(() => {
    if (multiple) return Array.isArray(value) ? value : [];
    return value ?? null;
  }, [value, multiple]);

  return (
    <div className={s.wrap}>
      <div className={s.top}>
        <div className={s.label}>{label}</div>
        <div className={s.right}>
          {loading ? <span className={s.muted}>Loading…</span> : null}
          <button type="button" className={s.clearBtn} onClick={clear}>
            Clear
          </button>
        </div>
      </div>

      {/* Selected chips */}
      {multiple && selected.length > 0 ? (
        <div className={s.chipsRow}>
          <div className={s.chipsLabel}>Selected ({selected.length})</div>
          <div className={s.chips}>
            {selected.map((id) => {
              const item = cache[id];
              const text = item?.label ?? id;
              return (
                <button
                  key={id}
                  type="button"
                  className={s.chip}
                  onClick={() => removeChip(id)}
                  title="Remove"
                >
                  <span className={s.chipText}>{text}</span>
                  <span className={s.chipX}>×</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <input
        className={s.search}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
      />

      {error ? <div className={s.error}>{error}</div> : null}

      {/* TEMP DEBUG: delete once confirmed */}
      {multiple ? (
        <div className={s.debug}>
          <b>debug value:</b> {JSON.stringify(debugValue)}
        </div>
      ) : null}

      <div className={s.list}>
        {options.map((o) => {
          const active = selectedSet.has(o.id);
          return (
            <button
              key={o.id}
              type="button"
              className={`${s.item} ${active ? s.itemActive : ''}`}
              onClick={() => toggle(o.id)}
              title={o.meta ?? ''}
            >
              <div className={s.itemMain}>
                <div className={s.itemLabel}>{o.label}</div>
                {o.meta ? <div className={s.itemMeta}>{o.meta}</div> : null}
              </div>
              <div className={s.pill}>{active ? 'Selected' : 'Select'}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
