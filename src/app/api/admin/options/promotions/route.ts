// src/app/api/admin/promotions/options/route.ts
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

    const promotions = await prisma.promotion.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } }
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
        type: true,
        applyMode: true,
        startsAt: true,
        endsAt: true
      }
    });

    const options = promotions.map((promotion) => {
      const bits: string[] = [];

      bits.push(promotion.status);
      bits.push(promotion.applyMode ?? 'CODE');
      bits.push(promotion.type);

      if (promotion.code) bits.push(`Code: ${promotion.code}`);
      if (promotion.startsAt) bits.push(`Starts: ${promotion.startsAt.toISOString().slice(0, 10)}`);
      if (promotion.endsAt) bits.push(`Ends: ${promotion.endsAt.toISOString().slice(0, 10)}`);

      return {
        id: promotion.id,
        label: promotion.name || 'Unnamed promotion',
        meta: bits.join(' • ')
      };
    });

    return NextResponse.json({ options });
  } catch (error) {
    console.error('Failed to load promotion options:', error);
    return NextResponse.json({ error: 'FAILED_TO_LOAD_PROMOTIONS' }, { status: 500 });
  }
}
