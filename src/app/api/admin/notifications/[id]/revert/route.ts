// src/app/api/admin/notifications/[id]/revert/route.ts
import { toJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import type { AboutSettingsDTO } from '@/types/aboutSettings';
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function notifIdFrom(url: string): string | null {
  const q = url.split('?')[0].split('#')[0];
  const parts = q.split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

type Meta =
  | {
      entity: 'homeSettings';
      prev: HomeSettingsDTO | null;
      next?: HomeSettingsDTO | null;
      hash?: string;
    }
  | {
      entity: 'aboutSettings';
      prev: AboutSettingsDTO | null;
      next?: AboutSettingsDTO | null;
      hash?: string;
    }
  | { entity?: string; prev?: unknown; next?: unknown; hash?: string };

export async function POST(req: Request) {
  const id = notifIdFrom(req.url);
  if (!id) return NextResponse.json({ ok: false, error: 'INVALID_ID' }, { status: 400 });

  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const meta = (notif.meta ?? {}) as unknown as Meta;

  if (meta.entity === 'homeSettings' && meta.prev) {
    const prev = meta.prev as HomeSettingsDTO;

    await prisma.homeSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        hero: toJson(prev.hero),
        delivery: toJson(prev.delivery),
        instagram: toJson(prev.instagram),
        promotions: toJson(prev.promotions),
        productShowcase: toJson(prev.productShowcase),
        reviews: toJson(prev.reviews)
      },
      update: {
        hero: toJson(prev.hero),
        delivery: toJson(prev.delivery),
        instagram: toJson(prev.instagram),
        promotions: toJson(prev.promotions),
        productShowcase: toJson(prev.productShowcase),
        reviews: toJson(prev.reviews)
      }
    });

    await prisma.notification.create({
      data: {
        kind: 'home_revert',
        title: 'Home settings reverted',
        body: 'Reverted to the previous version from this notification.',
        link: '/admin/site/home',
        meta: toJson(meta) // <-- FIX: coerce to InputJsonValue
      }
    });

    return NextResponse.json({ ok: true });
  }

  if (meta.entity === 'aboutSettings' && meta.prev) {
    const prev = meta.prev as AboutSettingsDTO;

    await prisma.aboutSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        hero: toJson(prev.hero),
        story: toJson(prev.story),
        stats: toJson(prev.stats),
        values: toJson(prev.values),
        cta: toJson(prev.cta)
      },
      update: {
        hero: toJson(prev.hero),
        story: toJson(prev.story),
        stats: toJson(prev.stats),
        values: toJson(prev.values),
        cta: toJson(prev.cta)
      }
    });

    await prisma.notification.create({
      data: {
        kind: 'about_revert',
        title: 'About settings reverted',
        body: 'Reverted to the previous version from this notification.',
        link: '/admin/site/about',
        meta: toJson(meta) // <-- FIX: coerce to InputJsonValue
      }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'NO_PREVIOUS_STATE' }, { status: 400 });
}
