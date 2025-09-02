import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { socketEmit } from '@/lib/socketEmit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { threadId, content } = await req.json();
  // TODO: auth
  const msg = await prisma.chatMessage.create({ data: { threadId, role: 'admin', content } });
  await prisma.chatThread.update({ where: { id: threadId }, data: { lastAdminAt: new Date() } });

  socketEmit(`thread-${threadId}`, 'message', { role: 'admin', content }).catch(() => {});
  return NextResponse.json({ ok: true, messageId: msg.id });
}
