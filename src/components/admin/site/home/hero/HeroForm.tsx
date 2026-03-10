'use client';

// src/components/admin/site/home/hero/HeroForm.tsx
import ImageUploader from '@/components/image/ImageUploader';
import type { HeroSettings } from '@/types/homeSettings';
import { useMemo } from 'react';
import Field from '../_shared/Field';
import s from './HeroForm.module.scss';

export default function HeroForm({
  value,
  onChange
}: {
  value: HeroSettings;
  onChange: (v: HeroSettings) => void;
}) {
  const images = useMemo(
    () => (value.images ?? (value.imageUrl ? [value.imageUrl] : [])).filter(Boolean),
    [value.images, value.imageUrl]
  );

  const setImage = (i: number, url: string) => {
    const next = [...images];
    next[i] = url;
    onChange({ ...value, images: next, imageUrl: next[0] ?? '' });
  };

  const addImage = () => onChange({ ...value, images: [...images, ''], imageUrl: images[0] ?? '' });

  const removeImage = (i: number) => {
    const next = images.filter((_, idx) => idx !== i);
    onChange({ ...value, images: next, imageUrl: next[0] ?? '' });
  };

  return (
    <div className={s.stack}>
      <div className={s.grid2}>
        <Field label="Title">
          <input
            className={s.input}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </Field>

        <Field label="Subtitle">
          <input
            className={s.input}
            value={value.subtitle}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
          />
        </Field>

        <Field label="Primary CTA Label">
          <input
            className={s.input}
            value={value.primaryCtaLabel}
            onChange={(e) => onChange({ ...value, primaryCtaLabel: e.target.value })}
          />
        </Field>

        <Field label="Primary CTA Link">
          <input
            className={s.input}
            value={value.primaryCtaHref}
            onChange={(e) => onChange({ ...value, primaryCtaHref: e.target.value })}
          />
        </Field>

        <Field label="Secondary CTA Label">
          <input
            className={s.input}
            value={value.secondaryCtaLabel ?? ''}
            onChange={(e) => onChange({ ...value, secondaryCtaLabel: e.target.value })}
          />
        </Field>

        <Field label="Secondary CTA Link">
          <input
            className={s.input}
            value={value.secondaryCtaHref ?? ''}
            onChange={(e) => onChange({ ...value, secondaryCtaHref: e.target.value })}
          />
        </Field>

        <Field label="Floating Tag">
          <input
            className={s.input}
            value={value.floatingTag ?? ''}
            onChange={(e) => onChange({ ...value, floatingTag: e.target.value })}
          />
        </Field>
      </div>

      <div className={s.field}>
        <span className={s.label}>Hero Images (slider)</span>

        <div className={s.uploaderSmall}>
          <ImageUploader
            label="Upload hero images"
            files={images}
            setFiles={(urls: string[]) =>
              onChange({ ...value, images: urls, imageUrl: urls[0] ?? '' })
            }
            pathSegments={['pages', 'home', 'hero']}
            itemName={value.title || 'home-hero'}
            accept="image/*"
          />
        </div>

        <div className={s.imagesWrap}>
          {images.length === 0 && <span className={s.help}>No images yet. Add one below.</span>}

          {images.map((url, i) => (
            <div key={i} className={s.imageRow}>
              <div className={s.thumb}>
                {url ? <img src={url} alt="" width="84" height="64" /> : <span>84×64</span>}
              </div>

              <input
                className={s.input}
                placeholder="/assets/… or https://…"
                value={url}
                onChange={(e) => setImage(i, e.target.value)}
              />

              <button type="button" className={s.secondary} onClick={() => removeImage(i)}>
                Remove
              </button>
            </div>
          ))}

          <div className={s.row}>
            <button type="button" className={s.secondary} onClick={addImage}>
              + Add Image
            </button>
            <span className={s.help}>First image appears first. Small files load fastest.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
