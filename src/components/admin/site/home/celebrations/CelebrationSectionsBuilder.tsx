'use client';

import { RemoteOptionsPicker } from '@/components/admin/home/RemoteOptionsPicker';
import MediaField from '@/components/media/MediaField';
import type { CampaignKey, CelebrationSection } from '@/types/homeSettings';
import { useMemo } from 'react';
import s from './CelebrationSectionsBuilder.module.scss';

const CAMPAIGN_OPTIONS: Array<{ value: CampaignKey; label: string; help: string }> = [
  { value: 'onam', label: 'Onam', help: 'Kerala harvest festival / festive foods.' },
  { value: 'vishu', label: 'Vishu', help: 'Malayali New Year selection.' },
  { value: 'diwali', label: 'Diwali', help: 'Festive sweets, savouries, gifting.' },
  { value: 'pongal', label: 'Pongal', help: 'Harvest celebration items.' },
  { value: 'ramadan_eid', label: 'Ramadan / Eid', help: 'Iftar & Eid essentials.' },
  { value: 'easter', label: 'Easter', help: 'Seasonal celebration range.' },
  { value: 'christmas', label: 'Christmas', help: 'Holiday specials and gifting.' },
  { value: 'new_year', label: 'New Year', help: 'New Year celebration products.' },
  { value: 'summer_bbq', label: 'Summer BBQ', help: 'Summer outdoor favourites.' },
  { value: 'back_to_uni', label: 'Back to Uni', help: 'Student essentials.' },
  { value: 'custom', label: 'Custom', help: 'Custom campaign / celebration.' }
];

function uid() {
  return `celebration_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clampText(v: unknown, max: number) {
  return String(v ?? '').slice(0, max);
}

function toIsoOrNull(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeSection(raw: Partial<CelebrationSection>): CelebrationSection {
  return {
    id: raw.id ?? uid(),
    key: raw.key ?? 'custom',
    enabled: raw.enabled !== false,
    title: clampText(raw.title, 120),
    description: clampText(raw.description, 500),
    imageUrl: raw.imageUrl ?? null,
    promotionIds: Array.isArray(raw.promotionIds) ? raw.promotionIds.filter(Boolean) : [],
    offerIds: Array.isArray(raw.offerIds) ? raw.offerIds.filter(Boolean) : [],
    categoryIds: Array.isArray(raw.categoryIds) ? raw.categoryIds.filter(Boolean) : [],
    productIds: Array.isArray(raw.productIds) ? raw.productIds.filter(Boolean) : [],
    ctaLabel: clampText(raw.ctaLabel ?? '', 40),
    ctaHref: clampText(raw.ctaHref ?? '/shop', 200),
    badge: raw.badge ? clampText(raw.badge, 40) : null,
    backgroundColor: raw.backgroundColor ? clampText(raw.backgroundColor, 20) : null,
    startAt: raw.startAt ?? null,
    endAt: raw.endAt ?? null
  };
}

function keyLabel(key: CampaignKey) {
  return CAMPAIGN_OPTIONS.find((x) => x.value === key)?.label ?? key;
}

function getCelebrationFolderName(row: CelebrationSection) {
  if (row.key && row.key !== 'custom') return row.key;
  return row.title?.trim() || 'custom-celebration';
}

interface Props {
  value: CelebrationSection[];
  onChange: (next: CelebrationSection[]) => void;
}

export default function CelebrationSectionsBuilder({ value, onChange }: Props) {
  const rows = useMemo(
    () => (Array.isArray(value) ? value.map((r) => normalizeSection(r)) : []),
    [value]
  );

  const setRows = (next: CelebrationSection[]) => {
    onChange(next.map((r) => normalizeSection(r)));
  };

  const add = (key: CampaignKey = 'custom') => {
    const label = keyLabel(key);

    const next: CelebrationSection = normalizeSection({
      id: uid(),
      key,
      enabled: true,
      title: key === 'custom' ? 'New Celebration Section' : `${label} Specials`,
      description: '',
      imageUrl: null,
      promotionIds: [],
      offerIds: [],
      categoryIds: [],
      productIds: [],
      ctaLabel: 'Shop now',
      ctaHref: '/shop',
      badge: 'Seasonal',
      backgroundColor: null,
      startAt: null,
      endAt: null
    });

    setRows([next, ...rows]);
  };

  const update = (id: string, patch: Partial<CelebrationSection>) => {
    setRows(rows.map((r) => (r.id === id ? normalizeSection({ ...r, ...patch }) : r)));
  };

  const remove = (id: string) => {
    setRows(rows.filter((r) => r.id !== id));
  };

  const moveUp = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx <= 0) return;
    const next = [...rows];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setRows(next);
  };

  const moveDown = (id: string) => {
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0 || idx >= rows.length - 1) return;
    const next = [...rows];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setRows(next);
  };

  return (
    <div className={s.wrap}>
      <div className={s.topBar}>
        <div>
          <h3 className={s.title}>Celebration Sections</h3>
          <p className={s.subtitle}>
            Build seasonal or festive feature sections with text, image, promotions, offers,
            categories, and selected products.
          </p>
        </div>

        <div className={s.topActions}>
          <button className={s.addBtn} type="button" onClick={() => add('custom')}>
            + Add Celebration
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={s.empty}>
          No celebration sections yet. Add one for Onam, Diwali, Christmas, Ramadan / Eid, or a
          custom seasonal campaign.
        </div>
      ) : (
        <div className={s.list}>
          {rows.map((row, index) => (
            <div key={row.id} className={s.card}>
              <div className={s.cardBar}>
                <div className={s.cardBarLeft}>
                  <span className={s.badge}>{keyLabel(row.key)}</span>
                  <span className={s.cardTitle}>{row.title || 'Untitled celebration'}</span>
                  {!row.enabled ? <span className={s.hiddenPill}>Hidden</span> : null}
                </div>

                <div className={s.cardBarRight}>
                  <label className={s.toggle}>
                    <input
                      type="checkbox"
                      checked={row.enabled !== false}
                      onChange={(e) => update(row.id, { enabled: e.target.checked })}
                    />
                    <span>{row.enabled !== false ? 'Enabled' : 'Hidden'}</span>
                  </label>

                  <button
                    type="button"
                    className={s.smallBtn}
                    onClick={() => moveUp(row.id)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    className={s.smallBtn}
                    onClick={() => moveDown(row.id)}
                    disabled={index === rows.length - 1}
                  >
                    ↓
                  </button>

                  <button type="button" className={s.deleteBtn} onClick={() => remove(row.id)}>
                    Delete
                  </button>
                </div>
              </div>

              <div className={s.grid}>
                <label className={s.field}>
                  <span className={s.label}>Celebration</span>
                  <select
                    className={s.input}
                    value={row.key}
                    onChange={(e) => {
                      const nextKey = e.target.value as CampaignKey;
                      const label = keyLabel(nextKey);

                      update(row.id, {
                        key: nextKey,
                        title:
                          row.title.trim().length > 0 &&
                          row.title !== 'New Celebration Section' &&
                          !row.title.endsWith('Specials')
                            ? row.title
                            : nextKey === 'custom'
                              ? 'New Celebration Section'
                              : `${label} Specials`
                      });
                    }}
                  >
                    {CAMPAIGN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <span className={s.help}>
                    {CAMPAIGN_OPTIONS.find((opt) => opt.value === row.key)?.help ?? ''}
                  </span>
                </label>

                <label className={s.field}>
                  <span className={s.label}>Badge</span>
                  <input
                    className={s.input}
                    value={row.badge ?? ''}
                    onChange={(e) =>
                      update(row.id, { badge: e.target.value ? e.target.value : null })
                    }
                    placeholder="Festive Collection"
                  />
                  <span className={s.help}>Optional short label shown above the title later.</span>
                </label>

                <label className={s.fieldFull}>
                  <span className={s.label}>Title</span>
                  <input
                    className={s.input}
                    value={row.title}
                    onChange={(e) => update(row.id, { title: e.target.value })}
                    placeholder="Onam Specials"
                  />
                </label>

                <label className={s.fieldFull}>
                  <span className={s.label}>Description</span>
                  <textarea
                    className={s.textarea}
                    rows={4}
                    value={row.description}
                    onChange={(e) => update(row.id, { description: e.target.value })}
                    placeholder="Celebrate with festive favourites, seasonal essentials, and limited-time savings."
                  />
                </label>

                <label className={s.field}>
                  <span className={s.label}>CTA Label</span>
                  <input
                    className={s.input}
                    value={row.ctaLabel ?? ''}
                    onChange={(e) => update(row.id, { ctaLabel: e.target.value })}
                    placeholder="Shop Onam"
                  />
                </label>

                <label className={s.field}>
                  <span className={s.label}>CTA Link</span>
                  <input
                    className={s.input}
                    value={row.ctaHref ?? ''}
                    onChange={(e) => update(row.id, { ctaHref: e.target.value })}
                    placeholder="/shop"
                  />
                </label>

                <label className={s.field}>
                  <span className={s.label}>Background Colour</span>
                  <input
                    className={s.input}
                    value={row.backgroundColor ?? ''}
                    onChange={(e) =>
                      update(row.id, {
                        backgroundColor: e.target.value ? e.target.value : null
                      })
                    }
                    placeholder="#f3e5c8"
                  />
                  <span className={s.help}>Optional future frontend styling hook.</span>
                </label>

                <label className={s.field}>
                  <span className={s.label}>Start At</span>
                  <input
                    className={s.input}
                    value={row.startAt ?? ''}
                    onChange={(e) => update(row.id, { startAt: toIsoOrNull(e.target.value) })}
                    placeholder="YYYY-MM-DD or ISO"
                  />
                </label>

                <label className={s.field}>
                  <span className={s.label}>End At</span>
                  <input
                    className={s.input}
                    value={row.endAt ?? ''}
                    onChange={(e) => update(row.id, { endAt: toIsoOrNull(e.target.value) })}
                    placeholder="YYYY-MM-DD or ISO"
                  />
                </label>

                <div className={s.fieldFull}>
                  <div className={s.mediaBlock}>
                    <div className={s.mediaText}>
                      <div className={s.label}>Celebration Image</div>
                      <div className={s.help}>
                        Upload the main festive visual for this campaign section.
                      </div>
                    </div>

                    <div className={s.mediaUploader}>
                      <MediaField
                        label="Celebration Media"
                        modalTitle={`Media Library — ${getCelebrationFolderName(row)}`}
                        pathSegments={['celebrations', getCelebrationFolderName(row)]}
                        itemName="main-image"
                        value={row.imageUrl ?? null}
                        onChange={(url) => update(row.id, { imageUrl: url })}
                        accept="image/*,video/mp4,video/webm"
                      />
                    </div>
                  </div>
                </div>

                <div className={s.fieldFull}>
                  <RemoteOptionsPicker
                    label="Linked promotions"
                    placeholder="Search promotions by name or code…"
                    endpoint="/api/admin/options/promotions"
                    multiple
                    value={Array.isArray(row.promotionIds) ? row.promotionIds : []}
                    onChange={(next) =>
                      update(row.id, {
                        promotionIds: Array.isArray(next) ? next : []
                      })
                    }
                  />
                  <div className={s.help}>
                    Link one or more promotions to this celebration campaign.
                  </div>
                </div>

                <div className={s.fieldFull}>
                  <RemoteOptionsPicker
                    label="Linked offers"
                    placeholder="Search offers by name or code…"
                    endpoint="/api/admin/site/home/sections/options/offers"
                    multiple
                    value={Array.isArray(row.offerIds) ? row.offerIds : []}
                    onChange={(next) =>
                      update(row.id, {
                        offerIds: Array.isArray(next) ? next : []
                      })
                    }
                  />
                  <div className={s.help}>
                    Link one or more offers to power this celebration section too.
                  </div>
                </div>

                <div className={s.fieldFull}>
                  <RemoteOptionsPicker
                    label="Linked categories"
                    placeholder="Search categories…"
                    endpoint="/api/admin/site/home/sections/options/categories"
                    multiple
                    value={Array.isArray(row.categoryIds) ? row.categoryIds : []}
                    onChange={(next) =>
                      update(row.id, {
                        categoryIds: Array.isArray(next) ? next : []
                      })
                    }
                  />
                  <div className={s.help}>
                    Choose categories that belong to this celebration collection.
                  </div>
                </div>

                <div className={s.fieldFull}>
                  <RemoteOptionsPicker
                    label="Linked products"
                    placeholder="Search products by name or SKU…"
                    endpoint="/api/admin/site/home/sections/options/products"
                    multiple
                    value={Array.isArray(row.productIds) ? row.productIds : []}
                    onChange={(next) =>
                      update(row.id, {
                        productIds: Array.isArray(next) ? next : []
                      })
                    }
                  />
                  <div className={s.help}>
                    Choose featured products that belong in this celebration collection.
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
