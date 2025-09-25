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

export interface HeroSettings {
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  floatingTag: string;
  imageUrl: string; // used in the hero card
}

export interface DeliverySettings {
  gbFreeThreshold: number;
  niFreeThreshold: number;
  frozenFee: number;
  message: string; // subheading line
}

export interface InstagramSettings {
  token: string; // long-lived Basic Display token
  usernameUrl: string; // https://instagram.com/...
  enabled: boolean;
}

export interface Promotion {
  key: PromotionTemplateKey | 'custom';
  title: string;
  message: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
}

export interface ProductShowcaseSettings {
  title: string; // heading above the slider
  kinds: ShowcaseKind[]; // selectable filters admin wants available
  selectedKind: ShowcaseKind; // which one to show on the home page
}

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

export interface HomeSettingsDTO {
  hero: HeroSettings;
  delivery: DeliverySettings;
  instagram: InstagramSettings;
  promotions: Promotion[];
  productShowcase: ProductShowcaseSettings;
  reviews: ReviewsSettings;
}
