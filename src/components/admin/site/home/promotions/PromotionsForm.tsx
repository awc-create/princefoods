'use client';

import { RemoteOptionsPicker } from '@/components/admin/home/RemoteOptionsPicker';
import ImageUploader from '@/components/image/ImageUploader';
import type { HomePromotionBannerSettings } from '@/types/homeSettings';
import Field from '../_shared/Field';
import s from './PromotionsForm.module.scss';

export default function PromotionsForm({
  value,
  onChange
}: {
  value: HomePromotionBannerSettings;
  onChange: (v: HomePromotionBannerSettings) => void;
}) {
  const patch = (next: Partial<HomePromotionBannerSettings>) =>
    onChange({
      ...value,
      ...next
    });

  return (
    <div className={s.stack}>
      <div className={s.card}>
        <div className={s.grid3}>
          <Field label="Banner Enabled">
            <select
              className={s.input}
              value={value.enabled ? '1' : '0'}
              onChange={(e) => patch({ enabled: e.target.value === '1' })}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </Field>

          <Field label="Start At (optional)">
            <input
              className={s.input}
              value={value.startAt ?? ''}
              onChange={(e) => patch({ startAt: e.target.value || null })}
              placeholder="YYYY-MM-DD or ISO"
            />
          </Field>

          <Field label="End At (optional)">
            <input
              className={s.input}
              value={value.endAt ?? ''}
              onChange={(e) => patch({ endAt: e.target.value || null })}
              placeholder="YYYY-MM-DD or ISO"
            />
          </Field>
        </div>

        <div className={s.stack}>
          <RemoteOptionsPicker
            label="Selected promotions"
            placeholder="Search promotions by name or code…"
            endpoint="/api/admin/options/promotions"
            multiple
            value={Array.isArray(value.promotionIds) ? value.promotionIds : []}
            onChange={(next) =>
              patch({
                promotionIds: Array.isArray(next) ? next : []
              })
            }
          />
        </div>

        <div className={s.grid2}>
          <Field label="Override Title (optional)">
            <input
              className={s.input}
              value={value.title ?? ''}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Special offers this week"
            />
          </Field>

          <Field label="Override Message (optional)">
            <input
              className={s.input}
              value={value.message ?? ''}
              onChange={(e) => patch({ message: e.target.value })}
              placeholder="Save on selected favourites while stocks last."
            />
          </Field>
        </div>

        <div className={s.grid2}>
          <Field label="CTA Label (optional)">
            <input
              className={s.input}
              value={value.ctaLabel ?? ''}
              onChange={(e) => patch({ ctaLabel: e.target.value })}
              placeholder="Shop deals"
            />
          </Field>

          <Field label="CTA Link (optional)">
            <input
              className={s.input}
              value={value.ctaHref ?? ''}
              onChange={(e) => patch({ ctaHref: e.target.value })}
              placeholder="/shop"
            />
          </Field>
        </div>

        <div className={s.stack}>
          <div className={s.uploaderSmall}>
            <ImageUploader
              label="Background Image (optional)"
              single
              pathSegments={['pages', 'home', 'promotions']}
              itemName="banner"
              files={value.backgroundImageUrl ? [value.backgroundImageUrl] : []}
              setFiles={(urls: string[]) =>
                patch({
                  backgroundImageUrl: urls?.[0] ?? null
                })
              }
            />
          </div>

          <Field label="Background Image URL">
            <input
              className={s.input}
              value={value.backgroundImageUrl ?? ''}
              onChange={(e) => patch({ backgroundImageUrl: e.target.value || null })}
              placeholder="/assets/... or https://..."
            />
          </Field>
        </div>
      </div>
    </div>
  );
}
