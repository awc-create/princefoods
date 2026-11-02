export interface StatItem {
  id: string;
  title: string;
  subtitle?: string;
}

export interface ValueCard {
  id: string;
  icon?: string; // emoji or URL later
  title: string;
  text: string;
}

export interface AboutHero {
  title: string;
  subtitle: string;
  imageUrl: string; // hero/media card image below heading
}

export interface AboutStory {
  heading: string;
  paragraphs: string[];
}

export interface AboutCTA {
  text: string;
  href: string;
}

/**
 * Headings that sit above the "values" and CTA sections. These were hardcoded
 * in the page component while everything around them was admin-editable, so
 * rewording them meant a code change. An empty string hides the heading.
 */
export interface AboutSections {
  valuesHeading: string;
  ctaHeading: string;
}

export interface AboutSettingsDTO {
  hero: AboutHero;
  story: AboutStory;
  sections: AboutSections;
  stats: StatItem[];
  values: ValueCard[];
  cta: AboutCTA;
}
