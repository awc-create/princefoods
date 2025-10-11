import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const settings = await prisma.faqSettings.findUnique({ where: { id: 1 } });
    const items = await prisma.faq.findMany({
      where: { active: true },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, question: true, answer: true }
    });

    return NextResponse.json({
      ok: true,
      data: {
        heading: settings?.heading ?? 'FAQs',
        subheading: settings?.subheading ?? 'Get answers to common questions.',
        items
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED_TO_LOAD_FAQ' }, { status: 500 });
  }
}
