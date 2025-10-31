// src/app/api/admin/orders/[id]/email/route.ts
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

export async function PATCH(req: NextRequest, _ctx: unknown) {
  try {
    const { id: orderId } = getParams(_ctx);
    const body = (await req.json()) as { email?: string | null };
    const raw = (body.email ?? '').trim();

    if (!raw || !isValidEmail(raw)) {
      return NextResponse.json(
        { ok: false, error: 'Enter a valid email address' },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, contactEmail: true }
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    const nextEmail = raw.toLowerCase();
    if (nextEmail === (order.contactEmail ?? '').toLowerCase()) {
      return NextResponse.json({ ok: true, email: order.contactEmail ?? nextEmail });
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: { contactEmail: nextEmail }
    });

    await logActivity(
      orderId,
      'NOTE',
      `Customer email updated from "${order.contactEmail ?? '—'}" to "${nextEmail}"`
    );

    return NextResponse.json({ ok: true, email: updated.contactEmail });
  } catch (err) {
    console.error('PATCH /email failed:', err);
    return NextResponse.json({ ok: false, error: 'EMAIL_UPDATE_FAILED' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, _ctx: unknown) {
  // forward-call to satisfy validator (no aliasing)
  return PATCH(req, _ctx);
}
