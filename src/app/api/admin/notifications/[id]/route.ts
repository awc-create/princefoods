// src/app/api/admin/notifications/[id]/route.ts
import { fromJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Avoid new URL() to satisfy your guard
function extractIdFromUrl(url: string): string | null {
  const q = url.split('?')[0].split('#')[0];
  const parts = q.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

/** GET /api/admin/notifications/[id] → single notification */
export async function GET(req: Request) {
  const id = extractIdFromUrl(req.url);
  if (!id) return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });

  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  return NextResponse.json(
    {
      ok: true,
      data: {
        id: n.id,
        kind: n.kind,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
        // meta is a Prisma JsonValue; normalize to plain JS
        meta: fromJson(n.meta)
      }
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/** PATCH /api/admin/notifications/[id] → mark one as read */
export async function PATCH(req: Request) {
  const id = extractIdFromUrl(req.url);
  if (!id) return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  if (!existing.readAt) {
    await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/notifications/[id] → delete one */
export async function DELETE(req: Request) {
  const id = extractIdFromUrl(req.url);
  if (!id) return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  await prisma.notification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
