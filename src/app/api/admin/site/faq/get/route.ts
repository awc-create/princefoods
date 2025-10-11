import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Page settings (singleton row)
    const settings = await prisma.faqSettings.findUnique({ where: { id: 1 } });

    // FAQs for editor (show all, even inactive; sorted by position then updatedAt)
    const items = await prisma.faq.findMany({
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, question: true, answer: true, active: true }
    });

    // Optional inbox: show the latest 25 asked questions + counts
    const inbox = await prisma.faqQuestion.findMany({
      orderBy: [{ askedCount: 'desc' }, { updatedAt: 'desc' }],
      take: 25,
      select: { id: true, question: true, askedCount: true, createdAt: true, updatedAt: true }
    });

    return NextResponse.json({
      ok: true,
      data: {
        heading: settings?.heading ?? 'FAQs',
        subheading: settings?.subheading ?? 'Get answers to common questions.',
        items: items.map((x) => ({
          id: x.id,
          question: x.question,
          answer: x.answer,
          visible: x.active
        })),
        inbox: inbox.map((q) => ({
          id: q.id,
          question: q.question,
          askedCount: q.askedCount,
          createdAt: q.createdAt.getTime(),
          updatedAt: q.updatedAt.getTime()
        }))
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED_TO_LOAD_FAQ' }, { status: 500 });
  }
}
