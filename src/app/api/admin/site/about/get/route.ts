// src/app/api/admin/site/about/get/route.ts
import { ABOUT_DEFAULTS, aboutRowToDto } from '@/lib/about-defaults';
import { toJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { safeError } from '@/lib/safe-error';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStore = { 'Cache-Control': 'no-store' };

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    // Read first. Opening an editor must never require a database WRITE —
    // otherwise a read-only/full database makes the page unopenable.
    const row = await prisma.aboutSettings.findUnique({ where: { id: 1 } });

    if (row) {
      return NextResponse.json({ ok: true, data: aboutRowToDto(row) }, { headers: noStore });
    }

    // Nothing saved yet. Try to seed defaults, but if the write fails
    // (disk full, read-only replica…) still let the editor open.
    try {
      const created = await prisma.aboutSettings.create({
        data: {
          id: 1,
          hero: toJson(ABOUT_DEFAULTS.hero),
          story: toJson(ABOUT_DEFAULTS.story),
          stats: toJson(ABOUT_DEFAULTS.stats),
          values: toJson(ABOUT_DEFAULTS.values),
          cta: toJson(ABOUT_DEFAULTS.cta),
          media: toJson(ABOUT_DEFAULTS.sections)
        }
      });
      return NextResponse.json({ ok: true, data: aboutRowToDto(created) }, { headers: noStore });
    } catch (seedErr) {
      const { message, code } = safeError(seedErr, 'GET /api/admin/site/about/get (seed)');
      return NextResponse.json(
        { ok: true, data: ABOUT_DEFAULTS, readOnly: true, warning: message, code },
        { headers: noStore }
      );
    }
  } catch (e) {
    const { message, code } = safeError(e, 'GET /api/admin/site/about/get');
    return NextResponse.json(
      { ok: false, error: message, code },
      { status: 500, headers: noStore }
    );
  }
}
