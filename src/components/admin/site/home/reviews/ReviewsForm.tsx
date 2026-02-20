'use client';

// src/components/admin/site/home/reviews/ReviewsForm.tsx
import type { ReviewsSettings } from '@/types/homeSettings';
import Field from '../_shared/Field';
import s from './ReviewsForm.module.scss';

function uid() {
  return `r_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function ReviewsForm({
  value,
  onChange
}: {
  value: ReviewsSettings;
  onChange: (v: ReviewsSettings) => void;
}) {
  const add = () => {
    const id = uid();
    onChange({
      ...value,
      items: [{ id, name: 'New Customer', text: 'Great service!' }, ...(value.items ?? [])]
    });
  };

  const update = (idx: number, patch: Partial<(typeof value.items)[number]>) => {
    onChange({
      ...value,
      items: (value.items ?? []).map((r, i) => (i === idx ? { ...r, ...patch } : r))
    });
  };

  const remove = (idx: number) => {
    onChange({
      ...value,
      items: (value.items ?? []).filter((_, i) => i !== idx)
    });
  };

  return (
    <div className={s.stack}>
      <div className={s.grid2}>
        <Field label="Autoplay">
          <select
            className={s.input}
            value={value.autoplay ? '1' : '0'}
            onChange={(e) => onChange({ ...value, autoplay: e.target.value === '1' })}
          >
            <option value="1">Yes</option>
            <option value="0">No</option>
          </select>
        </Field>

        <Field label="Show Count">
          <input
            type="number"
            className={s.input}
            min={1}
            max={10}
            value={value.showCount}
            onChange={(e) => onChange({ ...value, showCount: Number(e.target.value) })}
          />
        </Field>
      </div>

      <div className={s.row}>
        <button type="button" className={s.secondary} onClick={add}>
          + Add Review
        </button>
      </div>

      {(value.items ?? []).length === 0 && <div className={s.empty}>No reviews yet.</div>}

      {(value.items ?? []).map((r, idx) => (
        <div key={r.id} className={s.card}>
          <div className={s.grid2}>
            <Field label="Name">
              <input
                className={s.input}
                value={r.name}
                onChange={(e) => update(idx, { name: e.target.value })}
              />
            </Field>

            <Field label="Review">
              <input
                className={s.input}
                value={r.text}
                onChange={(e) => update(idx, { text: e.target.value })}
              />
            </Field>
          </div>

          <div className={s.rowRight}>
            <button type="button" className={s.danger} onClick={() => remove(idx)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
