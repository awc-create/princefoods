'use client';

import { RemoteOptionsPicker } from '@/components/admin/home/RemoteOptionsPicker';
import ImageUploader from '@/components/image/ImageUploader';
import type { DealsMode } from '@/types/homeSections';
import type { CampaignKey } from '@/types/homeSettings';
import { CAMPAIGNS, DEALS_MODES } from './showcaseSections.constants';
import type { ShowcaseCarouselConfig, Source } from './showcaseSections.types';
import { clamp } from './showcaseSections.utils';
import s from './ShowcaseSectionsBuilder.module.scss';

interface Props {
  rowId: string;
  source: Source;
  cfg: ShowcaseCarouselConfig | null;
  updateConfig: (id: string, patch: Partial<ShowcaseCarouselConfig>) => void;
}

export default function ShowcaseSectionSpecificFields({ rowId, source, cfg, updateConfig }: Props) {
  const needsMinAge =
    source === 'MOST_CLICKED' || source === 'LEAST_CLICKED' || source === 'LEAST_SOLD';

  const needsDealsMode = source === 'DEALS';
  const needsCategory = source === 'CATEGORY';
  const needsCollection = source === 'COLLECTION';
  const needsManual = source === 'MANUAL';
  const needsCampaign = source === 'CAMPAIGN';

  return (
    <>
      {needsDealsMode && (
        <div className={s.fieldFull}>
          <div className={s.block}>
            <label className={s.fieldFull}>
              <span className={s.label}>Deals Mode</span>
              <select
                className={s.input}
                value={(cfg?.dealsMode ?? 'OFFER_ENGINE') as DealsMode}
                onChange={(e) =>
                  updateConfig(rowId, {
                    dealsMode: e.target.value as DealsMode
                  })
                }
              >
                {DEALS_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <span className={s.help}>
                {DEALS_MODES.find((m) => m.value === (cfg?.dealsMode ?? 'OFFER_ENGINE'))?.help ??
                  ''}
              </span>
            </label>

            <label className={s.fieldFull}>
              <span className={s.label}>Offer Selection</span>
              <select
                className={s.input}
                value={cfg?.dealsSelectionMode ?? 'ALL_ACTIVE'}
                onChange={(e) =>
                  updateConfig(rowId, {
                    dealsSelectionMode: e.target.value as 'ALL_ACTIVE' | 'SELECTED',
                    offerIds:
                      e.target.value === 'SELECTED'
                        ? Array.isArray(cfg?.offerIds)
                          ? cfg.offerIds
                          : []
                        : []
                  })
                }
              >
                <option value="ALL_ACTIVE">All active offers</option>
                <option value="SELECTED">Selected offer(s)</option>
              </select>
              <span className={s.help}>
                Choose whether this section should use all live offers or only selected ones.
              </span>
            </label>

            {(cfg?.dealsSelectionMode ?? 'ALL_ACTIVE') === 'SELECTED' && (
              <div className={s.fieldFull}>
                <RemoteOptionsPicker
                  label="Selected offers"
                  placeholder="Search offers by name or code…"
                  endpoint="/api/admin/site/home/sections/options/offers"
                  multiple
                  value={Array.isArray(cfg?.offerIds) ? cfg.offerIds : []}
                  onChange={(next) =>
                    updateConfig(rowId, {
                      offerIds: Array.isArray(next) ? next : []
                    })
                  }
                />
                <div className={s.help}>
                  Pick one or more offers. Products from those offers will power this section.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {needsMinAge && (
        <label className={s.fieldFull}>
          <span className={s.label}>Min Age Days</span>
          <input
            className={s.input}
            type="number"
            min={0}
            max={365}
            value={Number(cfg?.minAgeDays ?? 14)}
            onChange={(e) =>
              updateConfig(rowId, {
                minAgeDays: clamp(Number(e.target.value), 0, 365)
              })
            }
          />
          <span className={s.help}>Stops brand-new products dominating “least” lists.</span>
        </label>
      )}

      {needsCategory && (
        <div className={s.fieldFull}>
          <RemoteOptionsPicker
            label="Category"
            placeholder="Search categories…"
            endpoint="/api/admin/site/home/sections/options/categories"
            value={String(cfg?.categoryId ?? '') || null}
            onChange={(next) =>
              updateConfig(rowId, {
                categoryId: typeof next === 'string' ? next : ''
              })
            }
          />
        </div>
      )}

      {needsCollection && (
        <div className={s.fieldFull}>
          <RemoteOptionsPicker
            label="Collection"
            placeholder="Search collections…"
            endpoint="/api/admin/site/home/sections/options/collections"
            value={String(cfg?.collection ?? '') || null}
            onChange={(next) =>
              updateConfig(rowId, {
                collection: typeof next === 'string' ? next : ''
              })
            }
          />
        </div>
      )}

      {needsCampaign && (
        <div className={s.fieldFull}>
          <div className={s.block}>
            <label className={s.fieldFull}>
              <span className={s.label}>Campaign Key</span>
              <select
                className={s.input}
                value={(cfg?.campaignKey ?? 'custom') as CampaignKey}
                onChange={(e) =>
                  updateConfig(rowId, {
                    campaignKey: e.target.value as CampaignKey
                  })
                }
              >
                {CAMPAIGNS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <span className={s.help}>Seasonal/promotional grouping.</span>
            </label>

            <div className={s.mediaRow}>
              <div className={s.mediaHint}>
                <div className={s.label}>Campaign image (optional)</div>
                <div className={s.help}>
                  Upload 1 image to push the celebration campaign on the storefront.
                </div>
              </div>

              <div className={s.mediaUploader}>
                <ImageUploader
                  single
                  pathSegments={['pages', 'home', 'showcase', String(cfg?.campaignKey ?? rowId)]}
                  itemName="main-image"
                  files={cfg?.campaignImageUrl ? [cfg.campaignImageUrl] : []}
                  setFiles={(urls) =>
                    updateConfig(rowId, {
                      campaignImageUrl: urls?.[0] ?? null
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {needsManual && (
        <div className={s.fieldFull}>
          <RemoteOptionsPicker
            label="Manual products"
            placeholder="Search products by name or SKU…"
            endpoint="/api/admin/site/home/sections/options/products"
            multiple
            value={Array.isArray(cfg?.productIds) ? cfg.productIds : []}
            onChange={(next) =>
              updateConfig(rowId, {
                productIds: Array.isArray(next) ? next : []
              })
            }
          />
          <div className={s.help}>Pick products directly from your DB.</div>
        </div>
      )}
    </>
  );
}
