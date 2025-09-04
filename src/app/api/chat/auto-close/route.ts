import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { threadId } = await req.json();
  if (!threadId) return NextResponse.json({ error: 'threadId required' }, { status: 400 });

  const idleMinutes = Number(process.env.CHAT_IDLE_MINUTES ?? 8);
  const cutoff = new Date(Date.now() - idleMinutes * 60_000);

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
  });
  if (!thread || thread.status !== 'open') {
    return NextResponse.json({ ok: true, already: true });
  }

  const last = thread.messages[0];
  if (!last) return NextResponse.json({ ok: false, reason: 'no messages' });

  const isIdle = last.createdAt <= cutoff;
  const waitingForUser = last.role !== 'user';

  if (!(isIdle && waitingForUser)) {
    return NextResponse.json({ ok: false, reason: 'not idle/eligible' });
  }

  await prisma.$transaction([
    prisma.chatThread.update({ where: { id: threadId }, data: { status: 'closed' } }),
    prisma.chatMessage.create({
      data: { threadId, role: 'system', content: `AUTO_CLOSE: idle > ${idleMinutes}m` }
    })
  ]);

  return NextResponse.json({ ok: true, closed: true });
}
