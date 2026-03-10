// src/types/homeSections.ts
import type { CampaignKey, IsoDateString } from './homeSettings';

export type HomeSectionType = 'PRODUCT_CAROUSEL';

export type HomeSectionProductSource =
  | 'BEST_SELLERS'
  | 'NEW_ARRIVALS'
  | 'DEALS'
  | 'MOST_CLICKED'
  | 'LEAST_CLICKED'
  | 'LEAST_SOLD'
  | 'COLLECTION'
  | 'CATEGORY'
  | 'MANUAL'
  | 'CAMPAIGN';

export type DealsMode = 'DISCOUNT_FIELDS' | 'RIBBON' | 'OFFER_ENGINE';

export type DealsSelectionMode = 'ALL_ACTIVE' | 'SELECTED';

export interface HomeSectionProductCarouselConfig {
  kind: 'PRODUCT_CAROUSEL';
  source: HomeSectionProductSource;
  limit?: number;

  collection?: string;
  categoryId?: string;
  productIds?: string[];

  dealsMode?: DealsMode;
  dealsSelectionMode?: DealsSelectionMode;
  offerIds?: string[];

  campaignKey?: CampaignKey;
  campaignImageUrl?: string | null;

  minAgeDays?: number;
}

export interface HomeSectionRow {
  id: string;

  title: string;
  subtitle?: string | null;

  type: HomeSectionType;

  enabled: boolean;
  position: number;

  startAt?: IsoDateString | null;
  endAt?: IsoDateString | null;

  isLocked?: boolean;

  /**
   * IMPORTANT:
   * DB stores JSON, so this must accept unknown/any JSON.
   * We validate/narrow via getCfg() before using it.
   */
  config?: unknown | null;

  bannerUrl?: string | null;
  mediaId?: string | null;

  createdAt?: string;
  updatedAt?: string;
}
