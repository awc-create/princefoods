// src/app/api/admin/site/home/save/route.ts
import { fromJson, toJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import { sendAdminPush } from '@/lib/push';
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HomeUpdateMeta {
  entity: 'homeSettings';
  prev: HomeSettingsDTO | null;
  next: HomeSettingsDTO;
  hash: string;
  source?: string;
}

function summarizeHomeChanges(prev: HomeSettingsDTO | null, next: HomeSettingsDTO): string {
  const changed: string[] = [];
  const cmp = <T>(a: T, b: T) => JSON.stringify(a) !== JSON.stringify(b);

  if (cmp(prev?.hero, next.hero)) changed.push('hero');
  if (cmp(prev?.delivery, next.delivery)) changed.push('delivery');
  if (cmp(prev?.instagram, next.instagram)) changed.push('instagram');
  if (cmp(prev?.productShowcase, next.productShowcase)) changed.push('showcase');

  if (cmp(prev?.promotions, next.promotions)) {
    const from = Array.isArray(prev?.promotions) ? prev!.promotions.length : 0;
    const to = next.promotions.length;
    changed.push(`promotions (${from}→${to})`);
  }

  if (cmp(prev?.reviews, next.reviews)) {
    const from = Array.isArray(prev?.reviews?.items) ? prev!.reviews.items.length : 0;
    const to = Array.isArray(next.reviews?.items) ? next.reviews.items.length : 0;
    changed.push(`reviews (${from}→${to})`);
  }

  return changed.length ? `Updated: ${changed.join(', ')}` : 'No changes.';
}

const sha1 = (obj: unknown) => crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HomeSettingsDTO;

    // normalize hero images
    const images = body.hero.images ?? (body.hero.imageUrl ? [body.hero.imageUrl] : []);
    body.hero = { ...body.hero, images, imageUrl: images[0] ?? body.hero.imageUrl ?? '' };

    // load prev
    const existing = await prisma.homeSettings.findUnique({ where: { id: 1 } });
    const prev: HomeSettingsDTO | null = existing
      ? {
          hero: fromJson(existing.hero),
          delivery: fromJson(existing.delivery),
          instagram: fromJson(existing.instagram),
          promotions: fromJson(existing.promotions),
          productShowcase: fromJson(existing.productShowcase),
          reviews: fromJson(existing.reviews)
        }
      : null;

    if (prev && JSON.stringify(prev) === JSON.stringify(body)) {
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const summary = summarizeHomeChanges(prev, body);
    const nextHash = sha1(body);

    let createdNotificationId: string | undefined;

    await prisma.$transaction(async (tx) => {
      await tx.homeSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          hero: toJson(body.hero),
          delivery: toJson(body.delivery),
          instagram: toJson(body.instagram),
          promotions: toJson(body.promotions),
          productShowcase: toJson(body.productShowcase),
          reviews: toJson(body.reviews)
        },
        update: {
          hero: toJson(body.hero),
          delivery: toJson(body.delivery),
          instagram: toJson(body.instagram),
          promotions: toJson(body.promotions),
          productShowcase: toJson(body.productShowcase),
          reviews: toJson(body.reviews)
        }
      });

      // de-dupe by hash against last home_update
      const last = await tx.notification.findFirst({
        orderBy: { createdAt: 'desc' },
        where: { kind: 'home_update' },
        take: 1
      });
      const lastMeta = last?.meta ? fromJson<HomeUpdateMeta>(last.meta) : null;
      if (lastMeta?.hash === nextHash) return;

      const meta: HomeUpdateMeta = {
        entity: 'homeSettings',
        prev,
        next: body,
        hash: nextHash,
        source: '/admin/site/home'
      };

      const created = await tx.notification.create({
        data: {
          kind: 'home_update',
          title: 'Home settings updated',
          body: summary,
          link: '/admin/notifications',
          meta: toJson(meta)
        }
      });

      createdNotificationId = created.id;
    });

    await sendAdminPush('Home settings updated', summary);

    return NextResponse.json(
      { ok: true, notificationId: createdNotificationId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SAVE_FAILED';
    console.error('POST /api/admin/site/home/save failed:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
