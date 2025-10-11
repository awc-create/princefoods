// src/app/api/admin/site/about/save/route.ts
import { fromJson, toJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import type { AboutSettingsDTO } from '@/types/aboutSettings';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface AboutUpdateMeta {
  entity: 'aboutSettings';
  prev: AboutSettingsDTO | null;
  next: AboutSettingsDTO;
  hash: string;
  source?: string;
}

const sha1 = (obj: unknown) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');

function summarizeAboutChanges(prev: AboutSettingsDTO | null, next: AboutSettingsDTO): string {
  const changed: string[] = [];
  const diff = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

  if (diff(prev?.hero, next.hero)) changed.push('hero');
  if (diff(prev?.story, next.story)) changed.push('story');
  if (diff(prev?.stats, next.stats)) {
    const from = prev?.stats?.length ?? 0;
    const to = next.stats.length;
    changed.push(`stats (${from}→${to})`);
  }
  if (diff(prev?.values, next.values)) {
    const from = prev?.values?.length ?? 0;
    const to = next.values.length;
    changed.push(`values (${from}→${to})`);
  }
  if (diff(prev?.cta, next.cta)) changed.push('cta');

  return changed.length ? `Updated: ${changed.join(', ')}` : 'No changes.';
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as AboutSettingsDTO;

    // Load previous value (if any)
    const existing = await prisma.aboutSettings.findUnique({ where: { id: 1 } });
    const prev: AboutSettingsDTO | null = existing
      ? {
          hero: fromJson(existing.hero),
          story: fromJson(existing.story),
          stats: fromJson(existing.stats),
          values: fromJson(existing.values),
          cta: fromJson(existing.cta)
        }
      : null;

    // If nothing changed, short-circuit
    if (prev && JSON.stringify(prev) === JSON.stringify(body)) {
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const summary = summarizeAboutChanges(prev, body);
    const nextHash = sha1(body);
    let createdNotificationId: string | undefined;

    await prisma.$transaction(async (tx) => {
      // Save
      await tx.aboutSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          hero: toJson(body.hero),
          story: toJson(body.story),
          stats: toJson(body.stats),
          values: toJson(body.values),
          cta: toJson(body.cta)
        },
        update: {
          hero: toJson(body.hero),
          story: toJson(body.story),
          stats: toJson(body.stats),
          values: toJson(body.values),
          cta: toJson(body.cta)
        }
      });

      // De-dupe by last 'about_update' hash
      const last = await tx.notification.findFirst({
        orderBy: { createdAt: 'desc' },
        where: { kind: 'about_update' },
        take: 1
      });

      const lastMeta = last?.meta ? fromJson<AboutUpdateMeta>(last.meta) : null;
      if (lastMeta?.hash === nextHash) return;

      const meta: AboutUpdateMeta = {
        entity: 'aboutSettings',
        prev,
        next: body,
        hash: nextHash,
        source: '/admin/site/about'
      };

      const created = await tx.notification.create({
        data: {
          kind: 'about_update',
          title: 'About settings updated',
          body: summary,
          link: '/admin/notifications',
          meta: toJson(meta)
        }
      });

      createdNotificationId = created.id;
    });

    // Optional: if you have this helper already (used on Home)
    // await sendAdminPush('About settings updated', summary);

    return NextResponse.json(
      { ok: true, notificationId: createdNotificationId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SAVE_FAILED';
    console.error('POST /api/admin/site/about/save failed:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
