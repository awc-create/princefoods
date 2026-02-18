// src/app/api/customers/[id]/offers/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAdmin(role?: string | null) {
  return role === 'HEAD' || role === 'STAFF';
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role ?? null;
  if (!session?.user || !isAdmin(role)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true }
  });
  if (!user) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const emailNorm = (user.email ?? '').trim().toLowerCase();

  const rows = await prisma.orderOffer.findMany({
    where: {
      OR: [
        { userId: user.id },
        ...(emailNorm ? [{ emailUsed: emailNorm }] : []),
        ...(emailNorm
          ? [{ order: { contactEmail: { equals: emailNorm, mode: 'insensitive' as const } } }]
          : [])
      ]
    },
    orderBy: { appliedAt: 'desc' },
    take: 500,
    select: {
      id: true,
      offerId: true,
      offerName: true,
      offerKind: true,
      discountPence: true,
      appliedAt: true,
      order: { select: { id: true, displayId: true, status: true, paymentStatus: true } }
    }
  });

  // summary: total used + totals by offerId
  const byOffer = rows.reduce<
    Record<string, { name: string; count: number; discountPence: number }>
  >((acc, r) => {
    const key = r.offerId;
    const cur = acc[key] ?? { name: r.offerName, count: 0, discountPence: 0 };
    cur.count += 1;
    cur.discountPence += Math.max(0, Math.trunc(r.discountPence ?? 0));
    acc[key] = cur;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    totalUses: rows.length,
    totalDiscountPence: rows.reduce((s, r) => s + Math.max(0, Math.trunc(r.discountPence ?? 0)), 0),
    byOffer,
    rows: rows.map((r) => ({
      ...r,
      appliedAt: r.appliedAt.toISOString()
    }))
  });
}
