// src/app/api/admin/offers/usage/route.ts
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

function clampInt(n: number, min: number, max: number) {
  const v = Number.isFinite(n) ? Math.trunc(n) : min;
  return Math.max(min, Math.min(max, v));
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const days = clampInt(Number(url.searchParams.get('days') ?? '30'), 1, 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // -----------------------------
    // Attempts (OfferAttempt)
    // -----------------------------
    const attempts = await prisma.offerAttempt.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 2500,
      select: {
        id: true,
        createdAt: true,
        checkoutId: true,

        offerId: true,
        offerName: true,
        offerKind: true,

        outcome: true,
        errorCode: true,

        currency: true,
        subtotalPence: true,
        shippingPence: true,
        discountPence: true,
        shippingDiscountPence: true,

        usedAt: true,

        userId: true,
        user: { select: { email: true } },
        email: true,

        orderId: true,
        order: {
          select: {
            displayId: true,
            status: true,
            paymentStatus: true
          }
        }
      }
    });

    const attemptsOut = attempts.map((a) => ({
      id: a.id,
      createdAt: a.createdAt,

      offerId: a.offerId ?? null,
      offerName: a.offerName ?? null,
      offerKind: a.offerKind ?? null,

      outcome: a.outcome,
      errorCode: a.errorCode ?? null,

      email: a.email ?? a.user?.email ?? null,
      userId: a.userId ?? null,

      orderId: a.orderId ?? null,
      orderDisplayId: a.order?.displayId ?? null,
      orderStatus: a.order?.status ?? null,
      orderPaymentStatus: a.order?.paymentStatus ?? null,

      subtotalPence: a.subtotalPence ?? null,
      shippingPence: a.shippingPence ?? null,
      discountPence: a.discountPence ?? 0,
      shippingDiscountPence: a.shippingDiscountPence ?? 0,

      redeemedOnOrder: Boolean(a.orderId) && a.outcome === 'ORDER_USED'
    }));

    // -----------------------------
    // Redemptions (OrderOffer)
    // -----------------------------
    const uses = await prisma.orderOffer.findMany({
      where: { appliedAt: { gte: since } },
      orderBy: { appliedAt: 'desc' },
      take: 2500,
      select: {
        id: true,
        appliedAt: true,

        offerId: true,
        offerName: true,
        offerKind: true,
        discountPence: true,

        orderId: true,
        order: {
          select: {
            displayId: true,
            status: true,
            paymentStatus: true
          }
        },

        userId: true,
        user: { select: { email: true } },
        emailUsed: true
      }
    });

    const redemptions = uses.map((r) => ({
      id: r.id,
      createdAt: r.appliedAt,

      offerId: r.offerId,
      offerName: r.offerName ?? null,
      offerKind: r.offerKind ?? null,

      email: r.emailUsed ?? r.user?.email ?? null,
      userId: r.userId ?? null,

      orderId: r.orderId,
      orderDisplayId: r.order?.displayId ?? null,
      orderStatus: r.order?.status ?? null,
      orderPaymentStatus: r.order?.paymentStatus ?? null,

      discountPence: r.discountPence ?? 0,
      shippingDiscountPence: 0
    }));

    return NextResponse.json({
      ok: true,
      days,
      attempts: attemptsOut,
      redemptions
    });
  } catch (e) {
    return authFail(e);
  }
}
