'use client';

import { useMemo, useState } from 'react';
import styles from './promotions.module.scss';
import type { PickerOption } from './types';
import { dedupeIds } from './utils';

export default function MultiPicker({
  title,
  placeholder,
  options,
  selectedIds,
  onChange
}: {
  title: string;
  placeholder: string;
  options: PickerOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selected = useMemo(() => {
    const map = new Map(options.map((o) => [o.id, o]));
    return selectedIds.map((id) => map.get(id)).filter(Boolean) as PickerOption[];
  }, [options, selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? options.filter((o) => {
          const blob = `${o.label} ${o.meta ?? ''}`.toLowerCase();
          return blob.includes(q);
        })
      : options;

    return base.filter((o) => !selectedSet.has(o.id)).slice(0, 80);
  }, [options, query, selectedSet]);

  function add(id: string) {
    onChange(dedupeIds([...selectedIds, id]));
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  return (
    <div className={styles.pickerBlock}>
      <div className={styles.pickerTitleRow}>
        <div className={styles.label}>{title}</div>
        <div className={styles.hint}>{selectedIds.length} selected</div>
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
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.pickerList}>
        {filtered.length === 0 ? (
          <div className={styles.pickerEmpty}>No matches.</div>
        ) : (
          filtered.map((o) => (
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
