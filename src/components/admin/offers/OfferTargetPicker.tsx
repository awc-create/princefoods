// src/components/admin/offers/OfferTargetPicker.tsx
'use client';

import { useMemo, useState } from 'react';
import styles from './offers.module.scss';
import { dedupeIds } from './utils';

export interface PickerOption {
  id: string;
  label: string;
  meta?: string;
}

export default function OfferTargetPicker({
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

    // exclude already selected + cap results (performance)
    return base.filter((o) => !selectedSet.has(o.id)).slice(0, 200);
  }, [options, query, selectedSet]);

  function add(id: string) {
    onChange(dedupeIds([...selectedIds, id]));
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className={styles.targetPickerCard}>
      <div className={styles.targetPickerHeader}>
        <div>
          <div className={styles.targetPickerTitle}>{title}</div>
          <div className={styles.targetPickerSub}>{selectedIds.length} selected</div>
        </div>

        {selectedIds.length > 0 && (
          <button type="button" className={styles.targetPickerClearBtn} onClick={clearAll}>
            Clear
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className={styles.targetPickerChips}>
          {selected.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.targetChip}
              onClick={() => remove(o.id)}
              title="Remove"
            >
              <span className={styles.targetChipMain}>{o.label}</span>
              {o.meta ? <span className={styles.targetChipMeta}>{o.meta}</span> : null}
              <span className={styles.targetChipX}>✕</span>
            </button>
          ))}
        </div>
      )}

      <div className={styles.targetPickerSearchRow}>
        <input
          className={styles.targetPickerSearch}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.targetPickerList} role="listbox" aria-label={`${title} options`}>
        {filtered.length === 0 ? (
          <div className={styles.targetPickerEmpty}>No matches.</div>
        ) : (
          filtered.map((o) => (
            <button
              key={o.id}
              type="button"
              className={styles.targetPickerItem}
              onClick={() => add(o.id)}
            >
              <div className={styles.targetPickerItemMain}>{o.label}</div>
              {o.meta ? <div className={styles.targetPickerItemMeta}>{o.meta}</div> : null}
            </button>
          ))
        )}
      </div>

      <div className={styles.targetPickerFooterHint}>Tip: click a selected chip to remove it.</div>
    </div>
  );
}
