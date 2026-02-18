import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { HomeSectionsSettings } from '@/types/homeSettings';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

const DEFAULT: HomeSectionsSettings = {
  enabled: false, // ✅ default OFF
  sections: []
};

export async function GET() {
  const session = await getServerSession(authOptions);
  const role: Role | null =
    session?.user && hasRole(session.user) ? ((session.user.role as Role | null) ?? null) : null;

  if (!session?.user || !role) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const row = await prisma.homeSettings.findUnique({
      where: { id: 1 }
    });

    const cfg = (row?.sections ?? null) as HomeSectionsSettings | null;
    if (!cfg || typeof cfg !== 'object') {
      return NextResponse.json({ ok: true, data: DEFAULT });
    }

    return NextResponse.json({ ok: true, data: cfg });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Failed to load' },
      { status: 500 }
    );
  }
}
