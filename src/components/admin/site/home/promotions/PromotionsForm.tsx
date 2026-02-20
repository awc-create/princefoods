'use client';

// src/components/admin/site/home/promotions/PromotionsForm.tsx
import ImageUploader from '@/components/image/ImageUploader';
import type { Promotion, PromotionTemplateKey } from '@/types/homeSettings';
import Field from '../_shared/Field';
import s from './PromotionsForm.module.scss';

const TEMPLATE_TEXT: Record<PromotionTemplateKey, string> = {
  onam: 'Celebrate Onam with traditional flavours.',
  vishu: 'Vishu specials—fresh starts & fresh flavours.',
  diwali: 'Diwali sweets & snacks—light up your table.',
  pongal: 'Pongal pantry picks for the harvest festival.',
  ramadan_eid: 'Ramadan & Eid essentials.',
  easter: 'Easter treats and springtime bakes.',
  christmas: 'Christmas cakes, spices & gifting.',
  new_year: 'New Year party snacks & spice up 2025.',
  summer_bbq: 'Summer BBQ marinades and grills.',
  back_to_uni: 'Back-to-Uni quick meals & snacks.'
};

export default function PromotionsForm({
  value,
  onChange
}: {
  value: Promotion[];
  onChange: (v: Promotion[]) => void;
}) {
  const addTemplate = (key: PromotionTemplateKey) => {
    const promo: Promotion = {
      key,
      title: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
      message: TEMPLATE_TEXT[key],
      imageUrl: '',
      ctaLabel: 'Shop Now',
      ctaHref: '/shop',
      active: true
    };

    onChange([promo, ...value]);
  };

  const update = (idx: number, patch: Partial<Promotion>) => {
    onChange(value.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className={s.stack}>
      {/* Template Buttons */}
      <div className={s.templateBar}>
        {(Object.keys(TEMPLATE_TEXT) as PromotionTemplateKey[]).map((k) => (
          <button key={k} type="button" className={s.templateBtn} onClick={() => addTemplate(k)}>
            + {k.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {value.length === 0 && (
        <div className={s.empty}>No promotions yet. Choose a template above.</div>
      )}

      {value.map((p, idx) => (
        <div key={idx} className={s.card}>
          <div className={s.grid3}>
            <Field label="Title">
              <input
                className={s.input}
                value={p.title}
                onChange={(e) => update(idx, { title: e.target.value })}
              />
            </Field>

            <Field label="Message">
              <input
                className={s.input}
                value={p.message}
                onChange={(e) => update(idx, { message: e.target.value })}
              />
            </Field>

            <Field label="Active">
              <select
                className={s.input}
                value={p.active ? '1' : '0'}
                onChange={(e) => update(idx, { active: e.target.value === '1' })}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </Field>
          </div>

          {/* Image */}
          <div className={s.stack}>
            <div className={s.uploaderSmall}>
              <ImageUploader
                label="Promotion Image"
                single
                endpoint="siteImage"
                images={p.imageUrl ? [p.imageUrl] : []}
                setImages={(urls: string[]) => update(idx, { imageUrl: urls[0] ?? '' })}
              />
            </div>

            <Field label="Image URL">
              <input
                className={s.input}
                value={p.imageUrl}
                onChange={(e) => update(idx, { imageUrl: e.target.value })}
                placeholder="/assets/... or https://..."
              />
            </Field>
          </div>

          {/* CTA */}
          <div className={s.grid2}>
            <Field label="CTA Label">
              <input
                className={s.input}
                value={p.ctaLabel}
                onChange={(e) => update(idx, { ctaLabel: e.target.value })}
              />
            </Field>

            <Field label="CTA Link">
              <input
                className={s.input}
                value={p.ctaHref}
                onChange={(e) => update(idx, { ctaHref: e.target.value })}
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
