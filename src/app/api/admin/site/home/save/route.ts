import { prisma } from '@/lib/prisma';
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HomeSettingsDTO;

    // Defensive normalization (helps avoid JSON undefined values)
    const images = body.hero.images ?? (body.hero.imageUrl ? [body.hero.imageUrl] : []);
    body.hero = { ...body.hero, images, imageUrl: images[0] ?? body.hero.imageUrl ?? '' };

    await prisma.homeSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        hero: body.hero as unknown as Prisma.InputJsonValue,
        delivery: body.delivery as unknown as Prisma.InputJsonValue,
        instagram: body.instagram as unknown as Prisma.InputJsonValue,
        promotions: body.promotions as unknown as Prisma.InputJsonValue,
        productShowcase: body.productShowcase as unknown as Prisma.InputJsonValue,
        reviews: body.reviews as unknown as Prisma.InputJsonValue
      },
      update: {
        hero: body.hero as unknown as Prisma.InputJsonValue,
        delivery: body.delivery as unknown as Prisma.InputJsonValue,
        instagram: body.instagram as unknown as Prisma.InputJsonValue,
        promotions: body.promotions as unknown as Prisma.InputJsonValue,
        productShowcase: body.productShowcase as unknown as Prisma.InputJsonValue,
        reviews: body.reviews as unknown as Prisma.InputJsonValue
      }
    });

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
