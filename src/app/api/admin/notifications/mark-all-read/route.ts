// src/app/api/admin/notifications/mark-all-read/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST() {
  const guard = await requireAdmin({ write: true });
  if (!guard.ok) return guard.response;

  try {
    const now = new Date();
    const res = await prisma.notification.updateMany({
      where: { readAt: null },
      data: { readAt: now }
    });

    return NextResponse.json(
      { ok: true, updated: res.count },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('POST /api/admin/notifications/mark-all-read failed:', err);
    return NextResponse.json({ ok: false, error: 'MARK_FAILED' }, { status: 500 });
  }
}
