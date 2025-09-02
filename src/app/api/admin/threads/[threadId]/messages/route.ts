import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } }
) {
  const { threadId } = params;
  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, status: true, customerEmail: true, createdAt: true },
  });
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }
  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true },
  });
  return NextResponse.json({ thread, messages });
}
