// src/types/homeSettings.ts
// ISO string or null for optional time windows
export type IsoDateString = string | null;

// Small helper for per-field timed override blocks
export type TimedText =
  | {
      text?: string;
      startAt?: IsoDateString; // local/UTC string; treat consistently in UI
      endAt?: IsoDateString;
    }
  | undefined;

/* ---------- Showcase & Promotions ---------- */
export type ShowcaseKind =
  | 'best_sellers'
  | 'on_sale'
  | 'b1g1'
  | 'new_arrivals'
  | 'trending'
  | 'top_rated'
  | 'seasonal';

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

/* ---------- Hero ---------- */
export interface HeroSettings {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  floatingTag?: string;

  /**
   * NEW (preferred): ordered list of images for the hero slider.
   * If provided and non-empty, this is used.
   */
  images?: string[];

  /**
   * LEGACY (fallback): single image URL.
   * Used only when `images` is empty/undefined, for backwards compatibility.
   */
  imageUrl?: string;

  // Optional global window to treat all hero fields as "seasonal" copy.
  overrideStart?: IsoDateString;
  overrideEnd?: IsoDateString;

  // Optional per-field windows (take precedence if defined)
  titleOverride?: TimedText;
  subtitleOverride?: TimedText;
  floatingTagOverride?: TimedText;
}

/* ---------- Delivery ---------- */
export interface DeliveryCard {
  id: string; // 'gb', 'ni', or a unique id like 'd_...'
  title: string; // e.g. "Delivery – Great Britain"
  freeThreshold: number; // e.g. 30
  frozenFee: number; // e.g. 3.99
  message?: string; // optional per-card note
  enabled?: boolean;
}

export interface DeliverySettings {
  gbFreeThreshold: number;
  niFreeThreshold: number;
  frozenFee: number;
  message?: string;

  // Optional global window
  overrideStart?: IsoDateString;
  overrideEnd?: IsoDateString;

  // Optional per-field window
  messageOverride?: TimedText;

  /** Preferred: dynamic delivery cards. If empty/undefined, UI falls back to GB/NI presets. */
  cards?: DeliveryCard[];
}

/* ---------- Instagram ---------- */
export interface InstagramSettings {
  token: string; // long-lived Basic Display token
  usernameUrl: string; // https://instagram.com/...
  enabled: boolean;
}

/* ---------- Promotions ---------- */
export interface Promotion {
  key: PromotionTemplateKey | 'custom';
  title: string;
  message: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
}

/* ---------- Product Showcase ---------- */
export interface ProductShowcaseSettings {
  title: string; // heading above the slider
  kinds: ShowcaseKind[]; // selectable filters admin wants available
  selectedKind: ShowcaseKind; // which one to show on the home page
}

/* ---------- Reviews ---------- */
export interface ReviewItem {
  id: string;
  name: string;
  text: string;
}

export interface ReviewsSettings {
  autoplay: boolean;
  showCount: number; // how many visible on the home page
  items: ReviewItem[];
}

/* ---------- Root DTO ---------- */
export interface HomeSettingsDTO {
  hero: HeroSettings;
  delivery: DeliverySettings;
  instagram: InstagramSettings;
  promotions: Promotion[];
  productShowcase: ProductShowcaseSettings;
  reviews: ReviewsSettings;
}
