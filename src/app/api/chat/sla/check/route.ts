import { sendSlaEmailTemplate } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = new URL(req.url).searchParams.get('key');
  if (key !== process.env.SLA_CRON_KEY)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const now = Date.now();
  const threads = await prisma.chatThread.findMany({
    where: { status: 'open', escalatedAt: { not: null }, emailEscalationSentAt: null },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  let sent = 0;
  for (const t of threads) {
    const slaMs = (t.slaMinutes ?? Number(process.env.CHAT_SLA_MINUTES ?? 10)) * 60000;
    const start = t.escalatedAt?.getTime() ?? 0;
    const overdue = start && now - start > slaMs;
    const hasAdminReply = !!t.lastAdminAt && t.lastAdminAt.getTime() > start;
    if (!overdue || hasAdminReply) continue;

    const latestUserMsg =
      [...t.messages].reverse().find((m) => m.role === 'user')?.content ?? '(no user message)';
    const url = `${process.env.APP_BASE_URL}/admin/chat?threadId=${t.id}`;
    const minutesOver = Math.max(0, Math.round((now - start - slaMs) / 60000));

    await sendSlaEmailTemplate({
      threadId: t.id,
      preview: latestUserMsg,
      adminUrl: url,
      minutesOverdue: minutesOver
    });

    await prisma.chatThread.update({
      where: { id: t.id },
      data: { emailEscalationSentAt: new Date() }
    });
    // optional courtesy note to customer:
    await prisma.chatMessage.create({
      data: {
        threadId: t.id,
        role: 'assistant',
        content:
          'Thanks for your message — we’ve emailed our support team to jump in. You’ll hear from us shortly.'
      }
    });

    sent++;
  }

  return NextResponse.json({ ok: true, sent });
}
