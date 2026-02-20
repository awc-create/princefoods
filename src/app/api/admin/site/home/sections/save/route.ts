// src/app/api/admin/site/home/sections/save/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { HomeSectionRow } from '@/types/homeSections';
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

function toDateOrNull(x: unknown): Date | null {
  const s = String(x ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface Body {
  sections: HomeSectionRow[];
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
    const body = (await req.json()) as Body;
    const input: HomeSectionRow[] = Array.isArray(body?.sections) ? body.sections : [];

    const normalized = input.map((s, i) => {
      const id = safeString(s?.id, 80) || `s_${Date.now()}_${i}`;
      const title = safeString(s?.title, 80) || 'Section';
      const subtitle = s?.subtitle == null ? null : safeString(s.subtitle, 140);
      const enabled = s?.enabled !== false;

      const position = clamp(Number(s?.position ?? i), 0, 9999);

      const startAt = toDateOrNull(s?.startAt);
      const endAt = toDateOrNull(s?.endAt);

      const isLocked = !!s?.isLocked;

      // ✅ NEW: mediaId support (nullable FK)
      const mediaId =
        typeof s?.mediaId === 'string' && s.mediaId.trim().length > 0 ? s.mediaId.trim() : null;

      // ✅ Prisma JSON null handling:
      // - if config missing/null -> store DB NULL via Prisma.DbNull
      // - if config present -> cast to InputJsonValue
      const config: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput =
        s?.config && typeof s.config === 'object'
          ? (s.config as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull;

      return {
        id,
        title,
        subtitle,
        type: 'PRODUCT_CAROUSEL' as const,
        enabled,
        position,
        startAt,
        endAt,
        isLocked,
        mediaId,
        config
      };
    });

    await prisma.$transaction(async (tx) => {
      const ids = normalized.map((x) => x.id);

      // delete anything not in payload (except locked)
      await tx.homeSection.deleteMany({
        where: {
          isLocked: false,
          ...(ids.length ? { id: { notIn: ids } } : {})
        }
      });

      // upsert each
      for (const s of normalized) {
        await tx.homeSection.upsert({
          where: { id: s.id },
          create: {
            id: s.id,
            title: s.title,
            subtitle: s.subtitle,
            type: s.type,
            enabled: s.enabled,
            position: s.position,
            startAt: s.startAt,
            endAt: s.endAt,
            isLocked: s.isLocked,
            mediaId: s.mediaId,
            config: s.config
          },
          update: {
            title: s.title,
            subtitle: s.subtitle,
            type: s.type,
            enabled: s.enabled,
            position: s.position,
            startAt: s.startAt,
            endAt: s.endAt,
            // never allow toggling lock from API
            mediaId: s.mediaId,
            config: s.config
          }
        });
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/site/home/sections/save failed:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Save failed' },
      { status: 500 }
    );
  }
}
