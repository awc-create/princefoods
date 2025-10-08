// src/app/api/admin/notifications/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Small helper: extract the last path segment (id) without using new URL()
function extractIdFromUrl(url: string): string | null {
  // strip query/hash
  const q = url.split('?')[0].split('#')[0];
  // last non-empty segment
  const parts = q.split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  return last ?? null;
}

/** PATCH /api/admin/notifications/[id] → mark one as read */
export async function PATCH(req: Request) {
  const id = extractIdFromUrl(req.url);
  if (!id) {
    return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });
  }

  await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() }
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/notifications/[id] → delete one */
export async function DELETE(req: Request) {
  const id = extractIdFromUrl(req.url);
  if (!id) {
    return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });
  }

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
