import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { HomeSectionRow, HomeSectionsSettings } from '@/types/homeSettings';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeString(x: unknown, max = 120) {
  return String(x ?? '').slice(0, max);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | null =
    session?.user && hasRole(session.user) ? ((session.user.role as Role | null) ?? null) : null;

  if (!session?.user || !role) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  if (!(role === 'HEAD' || role === 'STAFF')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as HomeSectionsSettings;

    const sections: HomeSectionRow[] = Array.isArray(body?.sections)
      ? body.sections.map((s: HomeSectionRow) => ({
          id: safeString(s?.id, 80) || `s_${Date.now()}`,
          enabled: s?.enabled !== false,
          title: safeString(s?.title, 80) || 'Section',
          kind: s?.kind,
          limit: clamp(Number(s?.limit ?? 12), 1, 48),
          note: s?.note ? safeString(s.note, 180) : undefined
        }))
      : [];

    const safe: HomeSectionsSettings = {
      enabled: !!body?.enabled,
      sections
    };

    // ✅ Prisma Json fields require InputJsonValue
    const safeJson = safe as unknown as Prisma.InputJsonValue;

    await prisma.homeSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        sections: safeJson
      },
      update: {
        sections: safeJson
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
