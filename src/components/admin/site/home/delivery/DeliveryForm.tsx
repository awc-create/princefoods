'use client';

// src/components/admin/site/home/delivery/DeliveryForm.tsx
import type { DeliveryCard, DeliverySettings } from '@/types/homeSettings';
import { useState } from 'react';
import Field from '../_shared/Field';
import s from './DeliveryForm.module.scss';

function seedLocked(value: DeliverySettings, cards: DeliveryCard[] | undefined): DeliveryCard[] {
  const gb =
    cards?.find((c) => c.id === 'gb') ??
    ({
      id: 'gb',
      title: 'Delivery – Great Britain',
      freeThreshold: value.gbFreeThreshold ?? 30,
      frozenFee: value.frozenFee ?? 3.99,
      enabled: true
    } satisfies DeliveryCard);

  const ni =
    cards?.find((c) => c.id === 'ni') ??
    ({
      id: 'ni',
      title: 'Delivery – Northern Ireland',
      freeThreshold: value.niFreeThreshold ?? 40,
      frozenFee: value.frozenFee ?? 3.99,
      enabled: true
    } satisfies DeliveryCard);

  const rest = (cards ?? []).filter((c) => c.id !== 'gb' && c.id !== 'ni');
  return [gb, ni, ...rest];
}

export default function DeliveryForm({
  value,
  onChange
}: {
  value: DeliverySettings;
  onChange: (v: DeliverySettings) => void;
}) {
  // Ensure GB/NI exist and are first; editable but not deletable
  const cards = seedLocked(value, value.cards);
  const locked = cards.slice(0, 2);
  const custom = cards.slice(2);

  const setCards = (next: DeliveryCard[]) => onChange({ ...value, cards: seedLocked(value, next) });

  const updateCard = (idx: number, patch: Partial<DeliveryCard>, isCustom = false) => {
    const next = [...cards];
    const offset = isCustom ? 2 : 0;
    next[idx + offset] = { ...next[idx + offset], ...patch };
    setCards(next);
  };

  const addCard = () => {
    const id = `d_${Date.now()}`;
    setCards([
      ...locked,
      { id, title: 'Delivery – Region', freeThreshold: 30, frozenFee: 3.99, enabled: true },
      ...custom
    ]);
  };

  const removeCustomCard = (idx: number) => {
    const nextCustom = custom.filter((_, i) => i !== idx);
    setCards([...locked, ...nextCustom]);
  };

  // Drag & drop for custom cards
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const onDragStart = (idx: number) => setDragIndex(idx);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (idx: number) => {
    if (dragIndex === null || dragIndex === idx) return;
    const next = [...custom];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(idx, 0, moved);
    setCards([...locked, ...next]);
    setDragIndex(null);
  };

  return (
    <div className={s.stack}>
      <div className={s.grid3}>
        <Field label="GB Free Threshold (£)">
          <input
            type="number"
            className={s.input}
            value={value.gbFreeThreshold}
            onChange={(e) => onChange({ ...value, gbFreeThreshold: Number(e.target.value) })}
          />
        </Field>

        <Field label="NI Free Threshold (£)">
          <input
            type="number"
            className={s.input}
            value={value.niFreeThreshold}
            onChange={(e) => onChange({ ...value, niFreeThreshold: Number(e.target.value) })}
          />
        </Field>

        <Field label="Frozen Packing Fee (£)">
          <input
            type="number"
            step="0.01"
            className={s.input}
            value={value.frozenFee}
            onChange={(e) => onChange({ ...value, frozenFee: Number(e.target.value) })}
          />
        </Field>

        <Field label="Global Message">
          <input
            className={s.input}
            value={value.message ?? ''}
            onChange={(e) => onChange({ ...value, message: e.target.value })}
          />
        </Field>
      </div>

      {/* Locked (GB/NI) */}
      {locked.map((c, idx) => (
        <div key={c.id} className={s.card}>
          <div className={s.grid3}>
            <Field label={`Title (${c.id.toUpperCase()})`}>
              <input
                className={s.input}
                value={c.title}
                onChange={(e) => updateCard(idx, { title: e.target.value }, false)}
              />
            </Field>

            <Field label="Free Threshold (£)">
              <input
                type="number"
                className={s.input}
                value={c.freeThreshold}
                onChange={(e) => updateCard(idx, { freeThreshold: Number(e.target.value) }, false)}
              />
            </Field>

            <Field label="Frozen Fee (£)">
              <input
                type="number"
                step="0.01"
                className={s.input}
                value={c.frozenFee}
                onChange={(e) => updateCard(idx, { frozenFee: Number(e.target.value) }, false)}
              />
            </Field>

            <Field label="Card Message (optional)">
              <input
                className={s.input}
                value={c.message ?? ''}
                onChange={(e) => updateCard(idx, { message: e.target.value }, false)}
              />
            </Field>

            <Field label="Enabled">
              <select
                className={s.input}
                value={c.enabled !== false ? '1' : '0'}
                onChange={(e) => updateCard(idx, { enabled: e.target.value === '1' }, false)}
              >
                <option value="1">Yes (show)</option>
                <option value="0">No (hide)</option>
              </select>
            </Field>
          </div>

          <div className={s.row}>
            <button
              className={s.danger}
              disabled
              title="Default card cannot be deleted"
              type="button"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      <div className={s.row}>
        <button className={s.secondary} onClick={addCard} type="button">
          + Add Delivery Card
        </button>
      </div>

      {/* Custom cards */}
      {custom.length === 0 && <div className={s.empty}>No custom delivery cards yet.</div>}

      {custom.map((c, idx) => (
        <div
          key={c.id}
          className={s.card}
          draggable
          onDragStart={() => onDragStart(idx)}
          onDragOver={onDragOver}
          onDrop={() => onDrop(idx)}
          title="Drag to reorder"
          style={{ cursor: 'grab' }}
        >
          <div className={s.grid3}>
            <Field label="Title">
              <input
                className={s.input}
                value={c.title}
                onChange={(e) => updateCard(idx, { title: e.target.value }, true)}
              />
            </Field>

            <Field label="Free Threshold (£)">
              <input
                type="number"
                className={s.input}
                value={c.freeThreshold}
                onChange={(e) => updateCard(idx, { freeThreshold: Number(e.target.value) }, true)}
              />
            </Field>

            <Field label="Frozen Fee (£)">
              <input
                type="number"
                step="0.01"
                className={s.input}
                value={c.frozenFee}
                onChange={(e) => updateCard(idx, { frozenFee: Number(e.target.value) }, true)}
              />
            </Field>

            <Field label="Card Message (optional)">
              <input
                className={s.input}
                value={c.message ?? ''}
                onChange={(e) => updateCard(idx, { message: e.target.value }, true)}
              />
            </Field>

            <Field label="Enabled">
              <select
                className={s.input}
                value={c.enabled !== false ? '1' : '0'}
                onChange={(e) => updateCard(idx, { enabled: e.target.value === '1' }, true)}
              >
                <option value="1">Yes (show)</option>
                <option value="0">No (hide)</option>
              </select>
            </Field>
          </div>

          <div className={s.rowRight}>
            <button className={s.danger} onClick={() => removeCustomCard(idx)} type="button">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
