export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { FAQSettingsDTO } from '@/types/faqSettings';
import { unstable_noStore as noStore } from 'next/cache';
import FaqClient from './FaqClient';

export const metadata = {
  title: 'FAQs',
  description: 'Get answers to common questions about our services.'
};

export default async function FaqPage() {
  noStore();

  const defaults: FAQSettingsDTO = {
    heading: 'FAQs',
    subheading: 'Get answers to common questions.',
    items: []
  };

  let initial: FAQSettingsDTO = defaults;

  try {
    const s = await prisma.faqSettings.findUnique({ where: { id: 1 } });

    const faqs = await prisma.faq.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, question: true, answer: true }
    });

    initial = {
      heading: s?.heading ?? defaults.heading,
      subheading: s?.subheading ?? defaults.subheading,
      items: faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        active: true
      }))
    };
  } catch {
    initial = defaults;
  }

  return <FaqClient initial={initial} />;
}
