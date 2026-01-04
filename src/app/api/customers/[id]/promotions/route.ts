import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function isAdmin(role?: string | null) {
  return role === 'HEAD' || role === 'STAFF';
}

function safeLower(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase();
}

function mapAttemptOutcome(outcome: string): 'APPLIED' | 'REJECTED' {
  if (outcome === 'ORDER_REJECTED' || outcome === 'EVAL_ERR') return 'REJECTED';
  return 'APPLIED';
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role ?? null;

  if (!session?.user || !isAdmin(role)) return bad('Unauthorized', 401);
  if (!id) return bad('Missing id');

  const url = new URL(req.url);
  const daysRaw = Number(url.searchParams.get('days') ?? '365');
  const days = Math.max(1, Math.min(3650, Number.isFinite(daysRaw) ? Math.trunc(daysRaw) : 365));
  const includeAttempts =
    (url.searchParams.get('includeAttempts') ?? '1') === '1' ||
    (url.searchParams.get('includeAttempts') ?? 'true') === 'true';

  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true }
  });

  if (!user) return bad('Customer not found', 404);

  const emailNorm = safeLower(user.email);

  const redemptionsRaw = await prisma.promotionRedemption.findMany({
    where: {
      createdAt: { gte: sinceDate },
      OR: [
        { userId: user.id },
        ...(emailNorm ? [{ emailUsed: emailNorm }] : []),
        ...(emailNorm
          ? [{ order: { contactEmail: { equals: emailNorm, mode: 'insensitive' as const } } }]
          : [])
      ]
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      createdAt: true,
      promotion: { select: { id: true, code: true, name: true, status: true } },
      order: { select: { id: true, displayId: true, status: true, paymentStatus: true } }
    }
  });

  const redemptions = redemptionsRaw.map((r) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    code: r.promotion.code,
    promotionId: r.promotion.id,
    promotionName: r.promotion.name ?? null,
    promotionStatus: r.promotion.status ?? null,
    orderId: r.order.id,
    orderDisplayId: r.order.displayId ?? null,
    orderStatus: r.order.status ?? null,
    orderPaymentStatus: r.order.paymentStatus ?? null
  }));

  let attempts: Array<{
    id: string;
    createdAt: string;
    code: string;
    outcome: 'APPLIED' | 'REJECTED';
    errorCode: string | null;
    promotionId: string | null;
    promotionName: string | null;
    orderId: string | null;
    orderDisplayId: string | null;
    orderStatus: string | null;
    orderPaymentStatus: string | null;
    subtotalPence: number | null;
    shippingPence: number | null;
    discountPence: number;
    shippingDiscountPence: number;
  }> = [];

  if (includeAttempts) {
    const attemptsRaw = await prisma.promotionAttempt.findMany({
      where: {
        createdAt: { gte: sinceDate },
        OR: [{ userId: user.id }, ...(emailNorm ? [{ email: emailNorm }] : [])]
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        createdAt: true,
        code: true,
        outcome: true,
        errorCode: true,
        promotion: { select: { id: true, name: true } },
        order: { select: { id: true, displayId: true, status: true, paymentStatus: true } },
        subtotalPence: true,
        shippingPence: true,
        discountPence: true,
        shippingDiscountPence: true
      }
    });

    attempts = attemptsRaw.map((a) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      code: a.code,
      outcome: mapAttemptOutcome(a.outcome),
      errorCode: a.errorCode ?? null,
      promotionId: a.promotion?.id ?? null,
      promotionName: a.promotion?.name ?? null,
      orderId: a.order?.id ?? null,
      orderDisplayId: a.order?.displayId ?? null,
      orderStatus: a.order?.status ?? null,
      orderPaymentStatus: a.order?.paymentStatus ?? null,
      subtotalPence: a.subtotalPence ?? null,
      shippingPence: a.shippingPence ?? null,
      discountPence: Math.max(0, Math.trunc(a.discountPence ?? 0)),
      shippingDiscountPence: Math.max(0, Math.trunc(a.shippingDiscountPence ?? 0))
    }));
  }

  return NextResponse.json({
    ok: true,
    since: sinceDate.toISOString(),
    customer: { id: user.id, email: user.email ?? null },
    redemptions,
    attempts
  });
}
