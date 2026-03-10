// src/components/admin/promotions/MultiPicker.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './promotions.module.scss';
import type { PickerOption } from './types';
import { dedupeIds } from './utils';

export default function MultiPicker({
  title,
  placeholder,
  options = [],
  selectedIds = [],
  onChange,

  // ✅ remote search mode (optional)
  remote = false,
  minChars = 2,
  onRemoteSearch,
  remoteLoading = false,
  remoteError = null
}: {
  title: string;
  placeholder: string;
  options?: PickerOption[];
  selectedIds?: string[];
  onChange: (next: string[]) => void;

  remote?: boolean;
  minChars?: number;
  onRemoteSearch?: (q: string) => void;
  remoteLoading?: boolean;
  remoteError?: string | null;
}) {
  const [query, setQuery] = useState('');

  const selectedSet = useMemo(() => new Set(selectedIds ?? []), [selectedIds]);

  const selected = useMemo(() => {
    const list = options ?? [];
    const map = new Map(list.map((o) => [o.id, o]));
    return (selectedIds ?? []).map((id) => map.get(id)).filter(Boolean) as PickerOption[];
  }, [options, selectedIds]);

  // ✅ when NOT remote, filter locally
  const localFiltered = useMemo(() => {
    const list = options ?? [];
    const q = query.trim().toLowerCase();

    const base = q
      ? list.filter((o) => {
          const blob = `${o.label} ${o.meta ?? ''}`.toLowerCase();
          return blob.includes(q);
        })
      : list;

    return base.filter((o) => !selectedSet.has(o.id)).slice(0, 80);
  }, [options, query, selectedSet]);

  // ✅ when remote, remove already-selected (server already searched)
  const remoteFiltered = useMemo(() => {
    const list = options ?? [];
    return list.filter((o) => !selectedSet.has(o.id)).slice(0, 80);
  }, [options, selectedSet]);

  const listToShow = remote ? remoteFiltered : localFiltered;

  // ✅ keep latest callback in a ref (prevents effect re-run loop)
  const remoteCbRef = useRef<typeof onRemoteSearch>(onRemoteSearch);
  useEffect(() => {
    remoteCbRef.current = onRemoteSearch;
  }, [onRemoteSearch]);

  // ✅ prevent resending the same query repeatedly
  const lastSentRef = useRef<string | null>(null);

  // ✅ remote searching (debounced, stable)
  useEffect(() => {
    if (!remote) return;

    const cb = remoteCbRef.current;
    if (!cb) return;

    const q = query.trim();

    // If minChars is 0, allow empty query (initial list / reset)
    if (minChars > 0 && q.length < minChars) {
      // if user cleared input and minChars > 0, don’t keep firing
      return;
    }

    // don't refire same value
    if (lastSentRef.current === q) return;

    const t = window.setTimeout(() => {
      // re-check (query might have changed since timeout)
      const current = query.trim();
      if (minChars > 0 && current.length < minChars) return;
      if (lastSentRef.current === current) return;

      lastSentRef.current = current;
      cb(current);
    }, 250);

    return () => window.clearTimeout(t);
    // IMPORTANT: do NOT depend on cb identity
  }, [remote, query, minChars]);

  // ✅ when switching between remote/local, reset tracking
  useEffect(() => {
    lastSentRef.current = null;
  }, [remote, minChars]);

  function add(id: string) {
    onChange(dedupeIds([...(selectedIds ?? []), id]));
  }

  function remove(id: string) {
    onChange((selectedIds ?? []).filter((x) => x !== id));
  }

  return (
    <div className={styles.pickerBlock}>
      <div className={styles.pickerTitleRow}>
        <div className={styles.label}>{title}</div>
        <div className={styles.hint}>{(selectedIds ?? []).length} selected</div>
      </div>

      {selected.length > 0 && (
        <div className={styles.chipRow}>
          {selected.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.chip}
              onClick={() => remove(o.id)}
              title="Remove"
            >
              <span className={styles.chipText}>{o.label}</span>
              {o.meta ? <span className={styles.chipMeta}>{o.meta}</span> : null}
              <span className={styles.chipX}>✕</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.pickerSearchRow}>
        <input
          className={styles.search}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            // allow clearing to re-fetch when minChars === 0
            if (remote && minChars === 0 && e.target.value.trim() === '') {
              lastSentRef.current = null;
            }
            setQuery(e.target.value);
          }}
        />
      </div>

      {/* ✅ remote status */}
      {remote && remoteError ? <div className={styles.pickerError}>{remoteError}</div> : null}

      <div className={styles.pickerList}>
        {remote && remoteLoading ? (
          <div className={styles.pickerEmpty}>Searching…</div>
        ) : listToShow.length === 0 ? (
          <div className={styles.pickerEmpty}>
            {remote && minChars > 0 && query.trim().length < minChars
              ? `Type ${minChars} or more characters…`
              : 'No matches.'}
          </div>
        ) : (
          listToShow.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.pickerItem}
              onClick={() => add(o.id)}
            >
              <div className={styles.pickerItemMain}>{o.label}</div>
              {o.meta ? <div className={styles.pickerItemSub}>{o.meta}</div> : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
