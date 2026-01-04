// src/app/api/admin/shipping/rates/[rateId]/tiers/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAdminRole(role?: string) {
  return role === 'HEAD' || role === 'STAFF';
}
function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request, ctx: { params: Promise<{ rateId: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const { rateId } = await ctx.params;

  const body = (await req.json()) as {
    minGramsExclusive?: number;
    maxGramsInclusive?: number | null;
    pricePence?: number;
  };

  const min =
    typeof body.minGramsExclusive === 'number'
      ? Math.max(0, Math.trunc(body.minGramsExclusive))
      : 0;
  const max =
    typeof body.maxGramsInclusive === 'number'
      ? Math.max(0, Math.trunc(body.maxGramsInclusive))
      : null;
  const price = typeof body.pricePence === 'number' ? Math.max(0, Math.trunc(body.pricePence)) : 0;

  const created = await prisma.shippingRateTier.create({
    data: {
      rateId,
      minGramsExclusive: min,
      maxGramsInclusive: max,
      pricePence: price
    }
  });

  return NextResponse.json({ ok: true, tier: created });
}
