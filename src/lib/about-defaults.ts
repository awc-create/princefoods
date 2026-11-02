// src/lib/about-defaults.ts
/**
 * Single source of truth for the About page's default content and for turning
 * a Prisma `AboutSettings` row into the DTO the page and editor both use.
 *
 * This existed in triplicate before — the public page, the admin GET route and
 * the admin editor each carried their own copy. That is how the CTA button
 * ended up pointing at `/collections`, a route that does not exist: the value
 * was fixed in one copy and not the others. One copy now, imported everywhere.
 */
import { fromJson } from '@/lib/json';
import type { AboutSettingsDTO } from '@/types/aboutSettings';

export const ABOUT_DEFAULTS: AboutSettingsDTO = {
  hero: {
    title: 'Your Favourite South Asian Grocery — A Reminder of Home',
    subtitle: 'Quality, value & nostalgia in every bite',
    imageUrl: '/assets/about.png'
  },
  story: {
    heading: 'Our Story',
    paragraphs: [
      'Since 2007, Prince Foods has been proudly connecting South Asian communities across England, Scotland, Wales and Ireland with the authentic flavours of home. What started as a small family business importing a few favourites from Kerala has grown into a trusted nationwide grocery brand — loved for our quality, reliability, and unbeatable prices.',
      'From everyday staples like rice, spices, and pulses to frozen delicacies and snacks, our curated collections make it easy to bring traditional cooking to your modern kitchen. Every item on our shelves is chosen with care to ensure genuine taste, trusted quality, and fair value for every household.'
    ]
  },
  sections: {
    valuesHeading: 'Why Shop with Prince Foods?',
    ctaHeading: 'Bringing Home Closer — One Meal at a Time.'
  },
  stats: [
    { id: 's1', title: '2007', subtitle: 'Year founded' },
    { id: 's2', title: 'UK & IE', subtitle: 'Nationwide delivery' },
    { id: 's3', title: 'Thousands', subtitle: 'Happy households' }
  ],
  values: [
    {
      id: 'v1',
      icon: '🌿',
      title: 'Authentic Ingredients',
      text: 'Carefully sourced staples and treats from trusted South Asian suppliers.'
    },
    {
      id: 'v2',
      icon: '🚚',
      title: 'Fast, Reliable Delivery',
      text: 'UK + Ireland-wide delivery with safe, temperature-aware handling.'
    },
    {
      id: 'v3',
      icon: '💰',
      title: 'Everyday Low Prices',
      text: 'Transparent value — no hidden markups, just fair pricing.'
    },
    {
      id: 'v4',
      icon: '❤️',
      title: 'Family-Run Since 2007',
      text: 'A brand built on trust, consistency, and community.'
    },
    {
      id: 'v5',
      icon: '🛒',
      title: 'Easy Online Ordering',
      text: 'Secure checkout and a simple shopping experience on any device.'
    }
  ],
  cta: { text: 'Browse Our Collections', href: '/shop' }
};

/**
 * Routes that were offered in the editor (or shipped as a default) but never
 * existed. The saved row still contains them, so heal on read rather than
 * asking someone to remember to re-pick the link in the admin.
 */
const DEAD_LINKS: Record<string, string> = {
  '/collections': '/shop',
  '/collections/': '/shop'
};

function healHref(href: string | undefined): string {
  if (!href) return ABOUT_DEFAULTS.cta.href;
  return DEAD_LINKS[href] ?? href;
}

/** Shape of the Prisma row, loosely typed so both callers can pass theirs. */
export interface AboutRowLike {
  hero?: unknown;
  story?: unknown;
  stats?: unknown;
  values?: unknown;
  cta?: unknown;
  media?: unknown;
}

/**
 * Normalise a Prisma row into the DTO, falling back per-section so a row saved
 * before a field existed still renders.
 *
 * `sections` is stored in the row's `media` column. That column was added for
 * an About media block that was never built, so rather than add a migration
 * (and risk the page 500ing if it isn't applied at deploy) it carries the
 * editable section headings. Renaming it is a tidy-up for a future migration.
 */
export function aboutRowToDto(row: AboutRowLike | null): AboutSettingsDTO {
  if (!row) return ABOUT_DEFAULTS;

  const sections = fromJson<AboutSettingsDTO['sections']>(row.media);
  const cta = fromJson<AboutSettingsDTO['cta']>(row.cta) ?? ABOUT_DEFAULTS.cta;

  return {
    hero: fromJson<AboutSettingsDTO['hero']>(row.hero) ?? ABOUT_DEFAULTS.hero,
    story: fromJson<AboutSettingsDTO['story']>(row.story) ?? ABOUT_DEFAULTS.story,
    stats: fromJson<AboutSettingsDTO['stats']>(row.stats) ?? ABOUT_DEFAULTS.stats,
    values: fromJson<AboutSettingsDTO['values']>(row.values) ?? ABOUT_DEFAULTS.values,
    cta: { ...cta, href: healHref(cta.href) },
    sections: {
      // `?? default` not `|| default`: an admin who deliberately clears a
      // heading gets an empty string, and the section renders without one.
      valuesHeading: sections?.valuesHeading ?? ABOUT_DEFAULTS.sections.valuesHeading,
      ctaHeading: sections?.ctaHeading ?? ABOUT_DEFAULTS.sections.ctaHeading
    }
  };
}
