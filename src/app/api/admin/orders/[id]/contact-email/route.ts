import { sendEmailChangedNotice } from '@/lib/email';
import { createAdminNotification } from '@/lib/notify';
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isLikelyEmail(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const s = v.trim();
  if (s.length < 5 || s.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: NextRequest, _ctx: unknown) {
  const { id: orderId } = getParams(_ctx);

  try {
    const body = (await req.json()) as { contactEmail?: string };
    if (!isLikelyEmail(body.contactEmail)) {
      return NextResponse.json({ ok: false, error: 'Invalid email address' }, { status: 400 });
    }
    const nextEmail = body.contactEmail.trim();

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, displayId: true, contactEmail: true }
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    if (nextEmail === (order.contactEmail ?? '')) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { contactEmail: nextEmail }
    });

    await logActivity(
      orderId,
      'NOTE',
      `Updated contact email: ${order.contactEmail ?? '—'} → ${nextEmail}`
    );

    await createAdminNotification({
      kind: 'order_email_changed',
      title: `Email changed for order ${order.displayId ?? orderId}`,
      body: `${order.contactEmail ?? '—'} → ${nextEmail}`,
      link: `/admin/orders/${orderId}`
    });

    await sendEmailChangedNotice({
      oldEmail: order.contactEmail,
      newEmail: nextEmail,
      orderId,
      displayId: order.displayId
    });

    return NextResponse.json({ ok: true, contactEmail: nextEmail });
  } catch (e) {
    console.error('Update contact email failed:', e);
    return NextResponse.json({ ok: false, error: 'UPDATE_FAILED' }, { status: 500 });
  }
}
