// src/app/api/admin/orders/[id]/shipping/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      contactEmail: true,
      shippingAddress: {
        select: {
          firstName: true,
          lastName: true,
          phoneE164: true,
          line1: true,
          line2: true,
          city: true,
          town: true, // ✅ NEW
          postcode: true,
          country: true
        }
      }
    }
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, shipping: null, error: 'Order not found' },
      { status: 404 }
    );
  }

  const s = order.shippingAddress;

  return NextResponse.json({
    ok: true,
    shipping: s
      ? {
          firstName: s.firstName ?? null,
          lastName: s.lastName ?? null,
          phoneE164: s.phoneE164 ?? null,
          line1: s.line1 ?? null,
          line2: s.line2 ?? null,
          city: s.city ?? null, // locality
          town: s.town ?? null, // post town
          postcode: s.postcode ?? null,
          country: (s.country ?? 'GB').toUpperCase(),
          email: order.contactEmail ?? null
        }
      : null
  });
}
