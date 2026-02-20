// src/app/api/admin/site/home/sections/get/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

export async function GET() {
  const session = await getServerSession(authOptions);
  const role: Role | null =
    session?.user && hasRole(session.user) ? ((session.user.role as Role | null) ?? null) : null;

  if (!session?.user || !role) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await prisma.homeSection.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: {
        media: {
          select: { id: true, url: true }
        }
      }
    });

    return NextResponse.json(
      { ok: true, data: rows },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to load' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
