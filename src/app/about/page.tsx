export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { AboutSettingsDTO } from '@/types/aboutSettings';
import { unstable_noStore as noStore } from 'next/cache';
import AboutClient from './AboutClient';

export default async function AboutPage() {
  noStore();

  // Default fallback if no DB row exists
  const defaults: AboutSettingsDTO = {
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
    cta: { text: 'Browse Our Collections', href: '/collections' }
  };

  // Fetch settings from Prisma (id = 1)
  let settings: AboutSettingsDTO = defaults;

  try {
    const row = await prisma.aboutSettings.findUnique({ where: { id: 1 } });

    if (row) {
      settings = {
        hero: (row.hero as unknown as AboutSettingsDTO['hero']) ?? defaults.hero,
        story: (row.story as unknown as AboutSettingsDTO['story']) ?? defaults.story,
        stats: (row.stats as unknown as AboutSettingsDTO['stats']) ?? defaults.stats,
        values: (row.values as unknown as AboutSettingsDTO['values']) ?? defaults.values,
        cta: (row.cta as unknown as AboutSettingsDTO['cta']) ?? defaults.cta
      };
    }
  } catch {
    // Fallback if database not reachable
    settings = defaults;
  }

  return <AboutClient settings={settings} />;
}
