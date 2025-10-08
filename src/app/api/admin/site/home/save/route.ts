// app/api/admin/site/home/save/route.ts
import { fromJson, toJson } from '@/lib/json';
import { prisma } from '@/lib/prisma';
import { sendAdminPush } from '@/lib/push';
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Summarize section-level changes for concise notifications. */
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HomeSettingsDTO;

    // Normalize hero.images and keep imageUrl in sync with first image.
    const images = body.hero.images ?? (body.hero.imageUrl ? [body.hero.imageUrl] : []);
    body.hero = { ...body.hero, images, imageUrl: images[0] ?? body.hero.imageUrl ?? '' };

    // Read previous (narrow JSON to app types with fromJson<> to fix TS2352)
    const existing = await prisma.homeSettings.findUnique({ where: { id: 1 } });
    const prev: HomeSettingsDTO | null = existing
      ? {
          hero: fromJson<HomeSettingsDTO['hero']>(existing.hero),
          delivery: fromJson<HomeSettingsDTO['delivery']>(existing.delivery),
          instagram: fromJson<HomeSettingsDTO['instagram']>(existing.instagram),
          promotions: fromJson<HomeSettingsDTO['promotions']>(existing.promotions),
          productShowcase: fromJson<HomeSettingsDTO['productShowcase']>(existing.productShowcase),
          reviews: fromJson<HomeSettingsDTO['reviews']>(existing.reviews)
        }
      : null;

    // If identical, skip write + notifications
    if (prev && JSON.stringify(prev) === JSON.stringify(body)) {
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const summary = summarizeHomeChanges(prev, body);

    // Persist and create notification atomically
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

      await tx.notification.create({
        data: {
          kind: 'home_update',
          title: 'Home settings updated',
          body: summary,
          link: '/admin/site/home',
          meta: toJson(body)
          // actorId: user?.id // if you wire session auth
        }
      });
    });

    // Best-effort push (non-blocking relative to DB commit)
    await sendAdminPush('Home settings updated', summary);

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'SAVE_FAILED';
    console.error('POST /api/admin/site/home/save failed:', err);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
