import { prisma } from '@/lib/prisma';
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HomeSettingsDTO;

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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('HomeSettings save failed:', err);
    return NextResponse.json({ ok: false, error: 'SAVE_FAILED' }, { status: 400 });
  }
}
