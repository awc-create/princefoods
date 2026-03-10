import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();

  const offers = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      bannerEnabled: true,
      OR: [{ bannerStartsAt: null }, { bannerStartsAt: { lte: now } }],
      AND: [{ OR: [{ bannerEndsAt: null }, { bannerEndsAt: { gte: now } }] }]
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    take: 5,
    select: {
      id: true,
      name: true,
      bannerTitle: true,
      bannerMessage: true,
      bannerCtaLabel: true,
      bannerCtaHref: true,
      bannerStartsAt: true,
      bannerEndsAt: true,
      payload: true
    }
  });

  return NextResponse.json({
    ok: true,
    offers: offers.map((o) => ({
      id: o.id,
      name: o.name,
      title: o.bannerTitle ?? o.name,
      message: o.bannerMessage ?? null,
      ctaLabel: o.bannerCtaLabel ?? 'Shop now',
      ctaHref: o.bannerCtaHref ?? '/',
      startsAt: o.bannerStartsAt ? o.bannerStartsAt.toISOString() : null,
      endsAt: o.bannerEndsAt ? o.bannerEndsAt.toISOString() : null
    }))
  });
}
