import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    // Page settings (singleton row)
    const settings = await prisma.faqSettings.findUnique({ where: { id: 1 } });

    // FAQs for editor (show all, even inactive; sorted by position then updatedAt)
    const items = await prisma.faq.findMany({
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, question: true, answer: true, active: true }
    });

    // Inbox. Unanswered first — those are the ones someone is waiting on —
    // then by how often asked, then newest.
    const inbox = await prisma.faqQuestion.findMany({
      orderBy: [{ status: 'asc' }, { askedCount: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        question: true,
        askedCount: true,
        createdAt: true,
        updatedAt: true,
        status: true,
        askerEmail: true,
        askerName: true,
        askerUserId: true,
        answer: true,
        answeredAt: true,
        answeredByEmail: true,
        publishedFaqId: true
      }
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
          updatedAt: q.updatedAt.getTime(),
          status: q.status,
          askerEmail: q.askerEmail,
          askerName: q.askerName,
          hasAccount: Boolean(q.askerUserId),
          answer: q.answer,
          answeredAt: q.answeredAt?.getTime() ?? null,
          answeredByEmail: q.answeredByEmail,
          published: Boolean(q.publishedFaqId)
        }))
      }
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED_TO_LOAD_FAQ' }, { status: 500 });
  }
}
