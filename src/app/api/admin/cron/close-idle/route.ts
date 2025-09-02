import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-cron-key');
  if (!key || key !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const idleMinutes = Number(process.env.CHAT_IDLE_MINUTES || 8);
  const cutoff = new Date(Date.now() - idleMinutes * 60_000);

  // Pull open threads with their latest message
  const threads = await prisma.chatThread.findMany({
    where: { status: 'open' },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const toClose = threads.filter(t => {
    const last = t.messages[0];
    if (!last) return false; // no messages? nothing to do
    const isIdle = last.createdAt <= cutoff;
    const waitingForUser = last.role !== 'user'; // last from assistant/admin/system
    return isIdle && waitingForUser;
  });

  for (const t of toClose) {
    await prisma.$transaction([
      prisma.chatThread.update({
        where: { id: t.id },
        data: { status: 'closed' },
      }),
      prisma.chatMessage.create({
        data: {
          threadId: t.id,
          role: 'system',
          content: `AUTO_CLOSE: idle > ${idleMinutes}m`,
        },
      }),
    ]);
  }

  return NextResponse.json({ closed: toClose.length, idleMinutes });
}
