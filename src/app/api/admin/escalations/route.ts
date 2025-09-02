import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const threads = await prisma.chatThread.findMany({
    where: { status: 'open', escalatedAt: { not: null } },
    orderBy: { escalatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  const items = threads.map(t => ({
    threadId: t.id,
    preview: t.messages[0]?.content ?? '(no message)',
    updatedAt: (t.lastUserAt ?? t.createdAt).toISOString(),
  }));

  return NextResponse.json(items);
}
