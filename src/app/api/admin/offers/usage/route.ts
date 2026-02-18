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

    /**
     * ✅ You have OrderOffer (actual applied offers)
     * ❌ You do not yet have OfferAttempt (attempts / rejected / applied-but-not-used)
     *
     * So we return:
     * - attempts: [] (for now)
     * - redemptions: derived from OrderOffer
     */
    const offerUses = await prisma.orderOffer.findMany({
      where: { appliedAt: { gte: since } },
      orderBy: { appliedAt: 'desc' },
      take: 2000,
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

    const redemptions = offerUses.map((r) => ({
      id: r.id,
      createdAt: r.appliedAt, // match promotions usage convention

      offerId: r.offerId,
      offerName: r.offerName ?? null,
      offerKind: r.offerKind ?? null,

      email: r.emailUsed ?? r.user?.email ?? null,
      userId: r.userId ?? null,

      orderId: r.orderId,
      orderDisplayId: r.order?.displayId ?? null,
      orderStatus: r.order?.status ?? null,
      orderPaymentStatus: r.order?.paymentStatus ?? null,

      // offers currently only store discountPence (no shipping discount in schema)
      discountPence: r.discountPence ?? 0,
      shippingDiscountPence: 0
    }));

    return NextResponse.json({
      ok: true,
      days,
      attempts: [], // ✅ until we add OfferAttempt model
      redemptions
    });
  } catch (e) {
    return authFail(e);
  }
}
