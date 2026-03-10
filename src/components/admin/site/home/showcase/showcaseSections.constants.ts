// src/components/admin/home/showcaseSections.constants.ts
import type { DealsMode } from '@/types/homeSections';
import type { CampaignKey } from '@/types/homeSettings';
import type { DealsModeOption, SourceOption } from './showcaseSections.types';

export const SOURCES: SourceOption[] = [
  { value: 'ALL', label: 'All', help: 'View all sections.' },

  { value: 'BEST_SELLERS', label: 'Best Sellers', help: 'Most sold products.' },
  { value: 'NEW_ARRIVALS', label: 'New Arrivals', help: 'Newest products.' },
  { value: 'DEALS', label: 'Deals', help: 'Discount/offer driven products.' },

  { value: 'MOST_CLICKED', label: 'Most Clicked', help: 'Ranked by clicks.' },
  { value: 'LEAST_CLICKED', label: 'Least Clicked', help: 'Lower clicks (discovery).' },
  { value: 'LEAST_SOLD', label: 'Least Sold', help: 'Lower sales (give exposure).' },

  { value: 'CATEGORY', label: 'Category', help: 'Show products from a category.' },
  { value: 'COLLECTION', label: 'Collection', help: 'Show products from a collection.' },
  { value: 'MANUAL', label: 'Manual', help: 'Pick specific products.' },
  { value: 'CAMPAIGN', label: 'Campaign', help: 'Seasonal / promo grouping.' }
];

export const DEALS_MODES: DealsModeOption[] = [
  { value: 'OFFER_ENGINE', label: 'Offer Engine', help: 'Use Offer table / engine logic.' },
  { value: 'DISCOUNT_FIELDS', label: 'Discount Fields', help: 'Use product discount fields.' },
  { value: 'RIBBON', label: 'Ribbon', help: 'Use ribbon/flag field.' }
];

export const CAMPAIGNS: CampaignKey[] = [
  'onam',
  'vishu',
  'diwali',
  'pongal',
  'ramadan_eid',
  'easter',
  'christmas',
  'new_year',
  'summer_bbq',
  'back_to_uni',
  'custom'
];

export const DEFAULT_DEALS_MODE: DealsMode = 'OFFER_ENGINE';
