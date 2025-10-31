// src/app/api/admin/orders/[id]/fulfill/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import type { NextRequest } from 'next/server';

interface Body {
  trackingNo?: string;
  carrier?: string;
  sendEmail?: boolean;
}

async function sendEmailIfConfigured(opts: {
  to: string;
  orderDisplay: string;
  trackingNo?: string;
  carrier?: string;
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? 'Prince Foods <no-reply@prince-v.com>';
  if (!key) return { ok: false as const, skipped: true as const, reason: 'No RESEND_API_KEY' };

  // Lazy load to avoid bundling if unused
  const { Resend } = await import('resend');
  const resend = new Resend(key);

  const subject = `Your order ${opts.orderDisplay} has shipped`;
  const trackingLine = opts.trackingNo
    ? `\nTracking: ${opts.carrier ?? 'Carrier'} • ${opts.trackingNo}`
    : '';

  const html = `
    <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <h2>Thanks for shopping with Prince Foods</h2>
      <p>Your order <strong>${opts.orderDisplay}</strong> is on the way.${trackingLine}</p>
      <p>If you have any questions, reply to this email.</p>
      <p style="color:#666;font-size:12px;margin-top:24px">Prince Foods</p>
    </div>
  `;

  const { error } = await resend.emails.send({
    from,
    to: opts.to,
    subject,
    html
  });

  if (error) return { ok: false as const, skipped: false as const, reason: String(error) };
  return { ok: true as const, skipped: false as const };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Body;
  const trackingNo = (body.trackingNo ?? '').trim() || undefined;
  const carrier = (body.carrier ?? '').trim() || undefined;
  const wantEmail = Boolean(body.sendEmail);

  // Find order (and current status + contact email)
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, status: true, contactEmail: true, displayId: true }
  });

  if (!order) {
    return new Response(JSON.stringify({ ok: false, error: 'Order not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Idempotency: if already fulfilled, just return ok
  if (order.status === 'FULFILLED') {
    return new Response(JSON.stringify({ ok: true, alreadyFulfilled: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Update order
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: 'FULFILLED',
      // store simple tracking fields on Order for now (no schema change needed):
      paymentStatus: 'CAPTURED', // usually already captured
      notes:
        trackingNo || carrier
          ? `Tracking: ${carrier ?? 'Carrier'} • ${trackingNo ?? ''}`.trim()
          : undefined
    }
  });

  await logActivity(order.id, 'FULFILLED', 'Marked fulfilled', {
    trackingNo,
    carrier
  });

  // Optional email
  let email: { ok: boolean; skipped?: boolean; reason?: string } | null = null;
  if (wantEmail && order.contactEmail) {
    email = await sendEmailIfConfigured({
      to: order.contactEmail,
      orderDisplay: order.displayId ?? order.id,
      trackingNo,
      carrier
    });
    await logActivity(
      order.id,
      'NOTE',
      email?.ok ? 'Shipping email sent' : 'Shipping email skipped/failed',
      {
        ok: email?.ok ?? false,
        skipped: email?.skipped ?? false,
        reason: email?.reason ?? null
      }
    );
  }

  return new Response(JSON.stringify({ ok: true, email }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
