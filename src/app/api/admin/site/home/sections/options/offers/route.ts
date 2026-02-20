// src/app/api/admin/site/home/sections/options/offers/route.ts
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/route-ctx';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authFail(e: unknown) {
  const msg = e instanceof Error ? e.message : 'UNAUTHENTICATED';
  const status = msg === 'FORBIDDEN' ? 403 : 401;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();

    const offers = await prisma.offer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } }
            ]
          }
        : undefined,
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        mode: true,
        startsAt: true,
        endsAt: true
      }
    });

    const options = offers.map((o) => {
      const bits: string[] = [];
      if (o.code) bits.push(`CODE: ${o.code}`);
      bits.push(`${o.status}`);
      bits.push(`${o.mode}`);
      return {
        id: o.id,
        label: o.name || 'Unnamed offer',
        meta: bits.join(' • ')
      };
    });

    return NextResponse.json({ options });
  } catch (e) {
    return authFail(e);
  }
}
