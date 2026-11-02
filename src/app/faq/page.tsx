export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { FAQSettingsDTO } from '@/types/faqSettings';
import { getServerSession } from 'next-auth';
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

  // Signed-in customers shouldn't have to retype what we already know. The
  // server still re-derives this on submit — the prefill is a convenience,
  // not the source of truth.
  const session = await getServerSession(authOptions);

  return (
    <FaqClient
      initial={initial}
      signedInAs={
        session?.user?.email
          ? { email: session.user.email, name: session.user.name ?? '' }
          : null
      }
    />
  );
}
