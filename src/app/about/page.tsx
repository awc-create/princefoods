export const dynamic = 'force-dynamic';

import { aboutRowToDto, ABOUT_DEFAULTS } from '@/lib/about-defaults';
import { prisma } from '@/lib/prisma';
import type { AboutSettingsDTO } from '@/types/aboutSettings';
import { unstable_noStore as noStore } from 'next/cache';
import AboutClient from './AboutClient';

export default async function AboutPage() {
  noStore();

  let settings: AboutSettingsDTO = ABOUT_DEFAULTS;

  try {
    settings = aboutRowToDto(await prisma.aboutSettings.findUnique({ where: { id: 1 } }));
  } catch {
    // Database unreachable — show the default copy rather than an error page.
    settings = ABOUT_DEFAULTS;
  }

  return <AboutClient settings={settings} />;
}
