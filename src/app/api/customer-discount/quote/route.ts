// src/app/api/customer-discount/quote/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ShippingKind = 'DRY' | 'FROZEN' | 'MIXED';

function clampPct(n: number) {
  return Math.max(0, Math.min(100, n));
}

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}

export async function POST(req: Request) {
  try {
    // ✅ IMPORTANT: no spread here
    const session = await getServerSession(authOptions);

    const userId = (session?.user as { id?: string } | null)?.id ?? null;

    if (!userId) {
      return NextResponse.json(
        { ok: true, customerDiscountPence: 0, customerShippingDiscountPence: 0 },
        { status: 200 }
      );
    }

    const body = (await req.json()) as {
      subtotalPence: number;
      shippingPence: number;
      itemDiscountAlreadyAppliedPence: number;
      promoShippingDiscountAlreadyAppliedPence: number;
      shippingKind: ShippingKind;
    };

    const subtotalPence = isInt(body.subtotalPence) ? Math.max(0, body.subtotalPence) : 0;
    const shippingPence = isInt(body.shippingPence) ? Math.max(0, body.shippingPence) : 0;

    const itemDiscountAlreadyAppliedPence = isInt(body.itemDiscountAlreadyAppliedPence)
      ? Math.max(0, body.itemDiscountAlreadyAppliedPence)
      : 0;

    const promoShippingDiscountAlreadyAppliedPence = isInt(
      body.promoShippingDiscountAlreadyAppliedPence
    )
      ? Math.max(0, body.promoShippingDiscountAlreadyAppliedPence)
      : 0;

    const shippingKind: ShippingKind =
      body.shippingKind === 'FROZEN' || body.shippingKind === 'MIXED' ? body.shippingKind : 'DRY';

    const now = new Date();

    const cd = await prisma.customerDiscount.findFirst({
      where: {
        userId,
        revokedAt: null,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        percentOff: true,
        applyShippingDiscount: true,
        shippingPercentOffDry: true,
        shippingPercentOffFrozen: true
      }
    });

    if (!cd) {
      return NextResponse.json(
        { ok: true, customerDiscountPence: 0, customerShippingDiscountPence: 0 },
        { status: 200 }
      );
    }

    // ✅ Item discount applies to remaining subtotal after offer/promo item discount
    const remainingSubtotal = Math.max(0, subtotalPence - itemDiscountAlreadyAppliedPence);
    const pctItem = clampPct(Math.trunc(cd.percentOff ?? 0));

    let customerDiscountPence = Math.round((remainingSubtotal * pctItem) / 100);
    customerDiscountPence = Math.max(0, Math.min(customerDiscountPence, remainingSubtotal));

    // ✅ Shipping discount applies to remaining shipping after promo shipping discount
    let customerShippingDiscountPence = 0;
    if (cd.applyShippingDiscount) {
      const pctDry = clampPct(Math.trunc(cd.shippingPercentOffDry ?? 0));
      const pctFrozen = clampPct(Math.trunc(cd.shippingPercentOffFrozen ?? 0));

      const pctShip =
        shippingKind === 'FROZEN'
          ? pctFrozen
          : shippingKind === 'DRY'
            ? pctDry
            : Math.max(pctDry, pctFrozen);

      const remainingShipping = Math.max(
        0,
        shippingPence - promoShippingDiscountAlreadyAppliedPence
      );

      customerShippingDiscountPence = Math.round((remainingShipping * pctShip) / 100);
      customerShippingDiscountPence = Math.max(
        0,
        Math.min(customerShippingDiscountPence, remainingShipping)
      );
    }

    return NextResponse.json(
      { ok: true, customerDiscountPence, customerShippingDiscountPence },
      { status: 200 }
    );
  } catch (e) {
    console.error('[POST /api/customer-discount/quote]', e);
    return NextResponse.json(
      { ok: false, error: 'Failed to quote customer discount.' },
      { status: 500 }
    );
  }
}
