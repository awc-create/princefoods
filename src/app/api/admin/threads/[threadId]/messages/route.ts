import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
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

export async function GET(_req: NextRequest, ctx: unknown) {
  const { threadId } = await getParams<{ threadId: string }>(ctx);

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, status: true, customerEmail: true, createdAt: true }
  });
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
  }

  const messages = await prisma.chatMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true, content: true, createdAt: true }
  });

  return NextResponse.json({ thread, messages });
}
