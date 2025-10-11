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

export interface AboutSettingsDTO {
  hero: AboutHero;
  story: AboutStory;
  stats: StatItem[];
  values: ValueCard[];
  cta: AboutCTA;
}
