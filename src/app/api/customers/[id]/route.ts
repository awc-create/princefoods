import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, name: true, email: true, phoneRaw: true, role: true,
      source: true, welcomeStatus: true, createdAt: true, updatedAt: true,
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // pull recent chat threads/messages for this user (by id OR email)
  const [threadsById, threadsByEmail] = await Promise.all([
    prisma.chatThread.findMany({
      where: { userKey: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
    prisma.chatThread.findMany({
      where: { customerEmail: user.email },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    }),
  ]);
  const threads = [...threadsById, ...threadsByEmail].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  ).slice(0, 10);

  const conversations = threads.length;
  const lastInteraction = threads[0]
    ? new Date(
        Math.max(
          threads[0].lastUserAt?.getTime() || 0,
          threads[0].lastAdminAt?.getTime() || 0
        )
      ).toLocaleString()
    : null;

  return NextResponse.json({
    contact: {
      ...user,
    },
    stats: {
      conversations,
      lastInteraction,
    },
    recentThreads: threads.map(t => ({
      id: t.id,
      status: t.status,
      createdAt: t.createdAt,
      lastUserAt: t.lastUserAt,
      lastAdminAt: t.lastAdminAt,
      lastMessagePreview: t.messages[0]?.content?.slice(0, 140) || '',
    })),
  });
}
