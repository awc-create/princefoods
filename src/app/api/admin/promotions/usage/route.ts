// src/app/api/admin/promotions/usage/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function isAdmin(role?: string | null) {
  return role === 'HEAD' || role === 'STAFF';
}

function clampInt(v: string | null, fallback: number, min: number, max: number) {
  const n = v ? Number.parseInt(v, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * ✅ No-any Prisma delegate guard:
 * prevents: Cannot read properties of undefined (reading 'findMany')
 * and gives a useful error message when Prisma client is stale / model renamed.
 */
type FindManyFn = (...args: unknown[]) => Promise<unknown>;

function hasFindManyDelegate(
  client: unknown,
  key: string
): client is Record<string, { findMany: FindManyFn }> {
  if (typeof client !== 'object' || client === null) return false;
  const rec = client as Record<string, unknown>;
  if (!(key in rec)) return false;

  const delegate = rec[key];
  if (typeof delegate !== 'object' || delegate === null) return false;

  const delRec = delegate as Record<string, unknown>;
  return typeof delRec.findMany === 'function';
}

type UsageOutcome = 'APPLIED' | 'REJECTED';

interface UsageAttemptRow {
  id: string;
  code: string;
  outcome: UsageOutcome;
  errorCode: string | null;
  email: string | null;
  userId: string | null;
  createdAt: string;

  currency: string;
  subtotalPence: number | null;
  shippingPence: number | null;
  discountPence: number;
  shippingDiscountPence: number;

  promotionId: string | null;
  promotionName: string | null;

  orderId: string | null;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;

  redeemedOnOrder: boolean;
}

interface UsageRedemptionRow {
  id: string;
  code: string;
  promotionId: string;
  promotionName: string | null;
  orderId: string;
  orderDisplayId: string | null;
  orderStatus: string | null;
  orderPaymentStatus: string | null;
  email: string | null;
  userId: string | null;
  createdAt: string;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as { role?: string } | null)?.role ?? null;

    if (!session?.user || !isAdmin(role)) return bad('Unauthorized', 401);

    // ✅ Guard against stale prisma generate / model rename
    if (!hasFindManyDelegate(prisma, 'promotionAttempt')) {
      return bad(
        'Prisma Client has no delegate "promotionAttempt". Ensure schema has model PromotionAttempt, run: npx prisma generate, then restart the dev server.',
        500
      );
    }
    if (!hasFindManyDelegate(prisma, 'promotionRedemption')) {
      return bad(
        'Prisma Client has no delegate "promotionRedemption". Ensure schema has model PromotionRedemption, run: npx prisma generate, then restart the dev server.',
        500
      );
    }

    const url = new URL(req.url);
    const days = clampInt(url.searchParams.get('days'), 30, 1, 365);

    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceIso = sinceDate.toISOString();

    // ---- PromotionAttempts (entered/applied/rejected) ----
    // We intentionally use the real Prisma delegate here. The guard above prevents it being undefined.
    const attemptsRaw = await prisma.promotionAttempt.findMany({
      where: { createdAt: { gte: sinceDate } },
      orderBy: { createdAt: 'desc' },
      take: 2000, // safety cap; adjust if you want
      select: {
        id: true,
        code: true,
        outcome: true,
        errorCode: true,
        email: true,
        userId: true,
        createdAt: true,

        currency: true,
        subtotalPence: true,
        shippingPence: true,
        discountPence: true,
        shippingDiscountPence: true,

        promotionId: true,
        promotion: { select: { name: true, code: true } },

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

    // ---- PromotionRedemptions (actually redeemed) ----
    const redemptionsRaw = await prisma.promotionRedemption.findMany({
      where: { createdAt: { gte: sinceDate } },
      orderBy: { createdAt: 'desc' },
      take: 2000, // safety cap
      select: {
        id: true,
        createdAt: true,
        promotionId: true,
        userId: true,
        emailUsed: true,
        orderId: true,

        promotion: { select: { code: true, name: true } },
        order: {
          select: {
            displayId: true,
            status: true,
            paymentStatus: true
          }
        }
      }
    });

    const redemptionOrderIds = new Set(redemptionsRaw.map((r) => r.orderId));

    // Map attempts into your client shape
    const attempts: UsageAttemptRow[] = attemptsRaw.map((a) => {
      // Your schema outcomes: EVAL_OK/EVAL_ERR/ORDER_APPLIED/ORDER_NOT_APPLIED/ORDER_REJECTED
      const outcome: UsageOutcome =
        a.outcome === 'EVAL_ERR' || a.outcome === 'ORDER_REJECTED' ? 'REJECTED' : 'APPLIED';

      const redeemedOnOrder = a.orderId ? redemptionOrderIds.has(a.orderId) : false;

      return {
        id: a.id,
        code: a.code,
        outcome,
        errorCode: a.errorCode ?? null,
        email: a.email ?? null,
        userId: a.userId ?? null,
        createdAt: a.createdAt.toISOString(),

        currency: a.currency ?? 'GBP',
        subtotalPence: a.subtotalPence ?? null,
        shippingPence: a.shippingPence ?? null,
        discountPence: Math.max(0, Math.trunc(a.discountPence ?? 0)),
        shippingDiscountPence: Math.max(0, Math.trunc(a.shippingDiscountPence ?? 0)),

        promotionId: a.promotionId ?? null,
        promotionName: a.promotion?.name ?? null,

        orderId: a.orderId ?? null,
        orderDisplayId: a.order?.displayId ?? null,
        orderStatus: a.order?.status ?? null,
        orderPaymentStatus: a.order?.paymentStatus ?? null,

        redeemedOnOrder
      };
    });

    const redemptions: UsageRedemptionRow[] = redemptionsRaw.map((r) => ({
      id: r.id,
      code: r.promotion.code, // ✅ code comes from Promotion
      promotionId: r.promotionId,
      promotionName: r.promotion.name ?? null,
      orderId: r.orderId,
      orderDisplayId: r.order?.displayId ?? null,
      orderStatus: r.order?.status ?? null,
      orderPaymentStatus: r.order?.paymentStatus ?? null,
      email: r.emailUsed ?? null,
      userId: r.userId ?? null,
      createdAt: r.createdAt.toISOString()
    }));

    return NextResponse.json({
      ok: true,
      since: sinceIso,
      attempts,
      redemptions
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load promotion usage.';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
