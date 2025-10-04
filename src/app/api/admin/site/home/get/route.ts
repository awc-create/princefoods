// src/app/api/admin/site/home/get/route.ts
import { prisma } from '@/lib/prisma';
import type { HomeSettingsDTO } from '@/types/homeSettings';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

const DEFAULTS: HomeSettingsDTO = {
  hero: {
    title: 'South Asian Groceries, Delivered.',
    subtitle:
      'Since 2007—authentic Indian & Sri Lankan favourites with fast UK & Ireland delivery.',
    primaryCtaLabel: 'Shop Best Sellers',
    primaryCtaHref: '/shop',
    secondaryCtaLabel: 'Browse Collections',
    secondaryCtaHref: '/collections',
    floatingTag: 'New • Onam Favourites',
    imageUrl: '/assets/slider1.jpg',
    // optional windows default to null/undefined
    overrideStart: null,
    overrideEnd: null
  },
  delivery: {
    gbFreeThreshold: 30,
    niFreeThreshold: 40,
    frozenFee: 3.99,
    message: 'No hidden fees. Frozen items are insulated for freshness.',
    overrideStart: null,
    overrideEnd: null
  },
  instagram: { token: '', usernameUrl: 'https://www.instagram.com/princefoodsuk/', enabled: true },
  promotions: [],
  productShowcase: {
    title: 'Featured',
    kinds: ['best_sellers', 'on_sale', 'b1g1', 'new_arrivals', 'trending', 'top_rated', 'seasonal'],
    selectedKind: 'best_sellers'
  },
  reviews: { autoplay: true, showCount: 4, items: [] }
};

export async function GET() {
  try {
    let row = await prisma.homeSettings.findUnique({ where: { id: 1 } });

    row ??= await prisma.homeSettings.create({
      data: {
        id: 1,
        hero: DEFAULTS.hero as unknown as Prisma.InputJsonValue,
        delivery: DEFAULTS.delivery as unknown as Prisma.InputJsonValue,
        instagram: DEFAULTS.instagram as unknown as Prisma.InputJsonValue,
        promotions: DEFAULTS.promotions as unknown as Prisma.InputJsonValue,
        productShowcase: DEFAULTS.productShowcase as unknown as Prisma.InputJsonValue,
        reviews: DEFAULTS.reviews as unknown as Prisma.InputJsonValue
      }
    });

    const data: HomeSettingsDTO = {
      hero: row.hero as unknown as HomeSettingsDTO['hero'],
      delivery: row.delivery as unknown as HomeSettingsDTO['delivery'],
      instagram: row.instagram as unknown as HomeSettingsDTO['instagram'],
      promotions: row.promotions as unknown as HomeSettingsDTO['promotions'],
      productShowcase: row.productShowcase as unknown as HomeSettingsDTO['productShowcase'],
      reviews: row.reviews as unknown as HomeSettingsDTO['reviews']
    };

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
