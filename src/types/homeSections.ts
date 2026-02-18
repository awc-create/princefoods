// src/types/homeSections.ts
import type { IsoDateString } from './homeSettings';

export type HomeSectionType = 'PRODUCT_CAROUSEL';

export type HomeSectionProductSource =
  | 'BEST_SELLERS'
  | 'DEALS'
  | 'NEW_ARRIVALS'
  | 'MOST_CLICKED'
  | 'LEAST_CLICKED'
  | 'LEAST_SOLD'
  | 'COLLECTION'
  | 'CATEGORY'
  | 'MANUAL';

export type DealsMode = 'DISCOUNT_FIELDS' | 'RIBBON' | 'OFFER_ENGINE';

export interface HomeSectionProductCarouselConfig {
  kind: 'PRODUCT_CAROUSEL';
  source: HomeSectionProductSource;
  limit?: number; // default 16

  // COLLECTION source
  collection?: string;

  // CATEGORY source
  categoryId?: string;

  // MANUAL source
  productIds?: string[];

  // DEALS source
  dealsMode?: DealsMode;

  // Optional safety so “least clicked/sold” doesn’t pick brand new items
  minAgeDays?: number; // e.g. 14
}

export interface HomeSectionRow {
  id: string;
  title: string;
  subtitle?: string | null;

  type: HomeSectionType;
  enabled: boolean;
  position: number;

  startAt?: IsoDateString;
  endAt?: IsoDateString;

  isLocked?: boolean;

  config?: HomeSectionProductCarouselConfig | null;

  createdAt?: string;
  updatedAt?: string;
}
