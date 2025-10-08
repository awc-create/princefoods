// app/api/admin/notifications/route.ts
import { prisma } from '@/lib/prisma';
import { urlFrom } from '@/lib/url'; // ✅ use your helper
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET /api/admin/notifications?take=20&cursor=<id>&unread=1
export async function GET(req: Request) {
  const { searchParams } = urlFrom(req.url); // ✅ guard-safe

  const take = Math.min(Math.max(Number(searchParams.get('take') ?? 20), 1), 100);
  const cursor = searchParams.get('cursor') ?? undefined;
  const unreadOnly = searchParams.get('unread') === '1';

  const where = unreadOnly ? { readAt: null } : {};

  const items = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  });

  const hasMore = items.length > take;
  const trimmed = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? trimmed[trimmed.length - 1]?.id : null;

  return NextResponse.json({ ok: true, data: trimmed, nextCursor });
}

// POST /api/admin/notifications
// { ids: string[] }
export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids?: string[] };
  if (!ids?.length) {
    return NextResponse.json({ ok: false, error: 'NO_IDS' }, { status: 400 });
  }
  await prisma.notification.updateMany({
    where: { id: { in: ids }, readAt: null },
    data: { readAt: new Date() }
  });
  return NextResponse.json({ ok: true });
}
