import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function forbid() {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

function normCode(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, '');
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!session?.user || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const url = new URL(req.url);

  const codeRaw = url.searchParams.get('code');
  const code = codeRaw ? normCode(codeRaw) : null;

  const promotionId = url.searchParams.get('promotionId');
  const orderId = url.searchParams.get('orderId');
  const userId = url.searchParams.get('userId');

  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase() || null;

  const outcome = url.searchParams.get('outcome'); // PromoAttemptOutcome string
  const checkoutId = url.searchParams.get('checkoutId');

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  const take = Math.min(
    200,
    Math.max(10, parseInt(url.searchParams.get('take') ?? '50', 10) || 50)
  );
  const cursor = url.searchParams.get('cursor');

  const where: Record<string, unknown> = {};

  if (code) where.code = code;
  if (promotionId) where.promotionId = promotionId;
  if (orderId) where.orderId = orderId;
  if (userId) where.userId = userId;
  if (email) where.email = email;
  if (checkoutId) where.checkoutId = checkoutId;
  if (outcome) where.outcome = outcome;

  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {})
    };
  }

  const rows = await prisma.promotionAttempt.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      checkoutId: true,
      code: true,
      outcome: true,
      errorCode: true,
      currency: true,
      subtotalPence: true,
      shippingPence: true,
      discountPence: true,
      shippingDiscountPence: true,
      createdAt: true,

      userId: true,
      email: true,
      orderId: true,
      promotionId: true,

      order: { select: { displayId: true, createdAt: true, contactEmail: true, status: true } },
      promotion: { select: { name: true, code: true } }
    }
  });

  const hasMore = rows.length > take;
  const data = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

  // quick summary (counts by outcome) for current filter
  const grouped = await prisma.promotionAttempt.groupBy({
    by: ['outcome'],
    where,
    _count: { outcome: true }
  });

  return NextResponse.json({
    ok: true,
    attempts: data.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      order: r.order ? { ...r.order, createdAt: r.order.createdAt.toISOString() } : null
    })),
    nextCursor,
    summary: grouped.reduce<Record<string, number>>((acc, g) => {
      acc[g.outcome] = g._count.outcome;
      return acc;
    }, {})
  });
}
