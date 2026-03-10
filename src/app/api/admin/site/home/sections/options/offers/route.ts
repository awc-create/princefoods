// src/app/api/admin/site/home/sections/options/offers/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
}

const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function safeLower(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase();
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session.user.role ?? undefined)
    : undefined;

  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const q = safeLower(url.searchParams.get('q'));
    const takeRaw = Number(url.searchParams.get('take') ?? '200');
    const take = Math.max(20, Math.min(1000, Number.isFinite(takeRaw) ? Math.trunc(takeRaw) : 200));

    const offers = await prisma.offer.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { code: { contains: q, mode: 'insensitive' as const } }
            ]
          }
        : undefined,
      orderBy: [{ updatedAt: 'desc' }],
      take,
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
      if (o.code) bits.push(`Code: ${o.code}`);
      bits.push(o.status);
      bits.push(o.mode);

      return {
        id: o.id,
        label: o.name || 'Unnamed offer',
        meta: bits.join(' • ')
      };
    });

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Failed to load offer options:', error);
    return NextResponse.json({ error: 'FAILED_TO_LOAD_OFFERS' }, { status: 500 });
  }
}
