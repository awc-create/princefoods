import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Promise type guard (no `any`)
function isPromise<T = unknown>(v: unknown): v is Promise<T> {
  return (
    !!v &&
    typeof v === 'object' &&
    'then' in (v as object) &&
    typeof (v as { then: unknown }).then === 'function'
  );
}

// Helper: supports both { params: {...} } and { params: Promise<...> }
async function getParams<T extends Record<string, unknown>>(ctx: unknown): Promise<T> {
  const raw = (ctx as { params?: unknown })?.params;
  if (isPromise<unknown>(raw)) {
    return (await raw) as T;
  }
  return (raw ?? {}) as T;
}

export async function GET(_: NextRequest, ctx: unknown) {
  const { id } = await getParams<{ id: string }>(ctx);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phoneRaw: true,
      role: true,
      source: true,
      welcomeStatus: true,
      createdAt: true,
      updatedAt: true
    }
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [threadsById, threadsByEmail] = await Promise.all([
    prisma.chatThread.findMany({
      where: { userKey: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
    }),
    prisma.chatThread.findMany({
      where: { customerEmail: user.email },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
    })
  ]);

  const threads = [...threadsById, ...threadsByEmail]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  const conversations = threads.length;
  const lastInteraction = threads[0]
    ? new Date(
        Math.max(threads[0].lastUserAt?.getTime() || 0, threads[0].lastAdminAt?.getTime() ?? 0)
      ).toLocaleString()
    : null;

  return NextResponse.json({
    contact: { ...user },
    stats: { conversations, lastInteraction },
    recentThreads: threads.map((t) => ({
      id: t.id,
      status: t.status,
      createdAt: t.createdAt,
      lastUserAt: t.lastUserAt,
      lastAdminAt: t.lastAdminAt,
      lastMessagePreview: t.messages[0]?.content?.slice(0, 140) || ''
    }))
  });
}
