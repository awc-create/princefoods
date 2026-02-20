// src/types/homeSettings.ts

// ISO string (or null) for optional time windows
export type IsoDateString = string | null;

/* =========================================================
   Timed Overrides
========================================================= */

export type TimedText =
  | {
      text?: string;
      startAt?: IsoDateString;
      endAt?: IsoDateString;
    }
  | undefined;

/* =========================================================
   Promotions (Campaign System)
========================================================= */

export type PromotionTemplateKey =
  | 'onam'
  | 'vishu'
  | 'diwali'
  | 'pongal'
  | 'ramadan_eid'
  | 'easter'
  | 'christmas'
  | 'new_year'
  | 'summer_bbq'
  | 'back_to_uni';

export type CampaignKey = PromotionTemplateKey | 'custom';

export interface Promotion {
  key: CampaignKey;

  title: string;
  message: string;

  imageUrl: string;

  ctaLabel: string;
  ctaHref: string;

  active: boolean;

  startAt?: IsoDateString;
  endAt?: IsoDateString;
}

/* =========================================================
   Hero
========================================================= */

export interface HeroSettings {
  title: string;
  subtitle: string;

  primaryCtaLabel: string;
  primaryCtaHref: string;

  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;

  floatingTag?: string;

  /** Preferred slider images */
  images?: string[];

  /** Legacy fallback */
  imageUrl?: string;

  overrideStart?: IsoDateString;
  overrideEnd?: IsoDateString;

  titleOverride?: TimedText;
  subtitleOverride?: TimedText;
  floatingTagOverride?: TimedText;
}

/* =========================================================
   Delivery
========================================================= */

export interface DeliveryCard {
  id: string; // 'gb', 'ni', or custom like 'd_...'
  title: string;
  freeThreshold: number;
  frozenFee: number;
  message?: string;
  enabled?: boolean;
}

export interface DeliverySettings {
  gbFreeThreshold: number;
  niFreeThreshold: number;
  frozenFee: number;

  message?: string;

  overrideStart?: IsoDateString;
  overrideEnd?: IsoDateString;

  messageOverride?: TimedText;

  cards?: DeliveryCard[];
}

/* =========================================================
   Instagram
========================================================= */

export interface InstagramSettings {
  token: string;
  usernameUrl: string;
  enabled: boolean;
}

/* =========================================================
   Reviews
========================================================= */

export interface ReviewItem {
  id: string;
  name: string;
  text: string;
}

export interface ReviewsSettings {
  autoplay: boolean;
  showCount: number;
  items: ReviewItem[];
}

/* =========================================================
   Legacy Showcase (Optional — can be phased out)
========================================================= */

export type ShowcaseKind =
  | 'best_sellers'
  | 'on_sale'
  | 'b1g1'
  | 'new_arrivals'
  | 'trending'
  | 'top_rated'
  | 'seasonal';

export interface ProductShowcaseSettings {
  title: string;
  kinds: ShowcaseKind[];
  selectedKind: ShowcaseKind;
}

/* =========================================================
   Root DTO
========================================================= */

export interface HomeSettingsDTO {
  hero: HeroSettings;
  delivery: DeliverySettings;
  instagram: InstagramSettings;
  promotions: Promotion[];
  productShowcase: ProductShowcaseSettings;
  reviews: ReviewsSettings;
}
