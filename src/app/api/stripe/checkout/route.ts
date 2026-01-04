// src/app/api/stripe/checkout/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function normCurrency(raw: string | null | undefined) {
  const c = (raw ?? 'GBP').trim().toUpperCase();
  return c || 'GBP';
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secret) return bad('NO_STRIPE_KEY', 400);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim();
  if (!siteUrl) return bad('NO_SITE_URL', 400);

  const stripe = new Stripe(secret);

  const body = (await req.json().catch(() => null)) as unknown;
  if (!body || typeof body !== 'object') return bad('BAD_REQUEST', 400);

  const { orderId } = body as { orderId?: string };

  if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
    return bad('BAD_REQUEST', 400);
  }

  // Pull trusted order totals (NEVER trust client "lines" for money)
  const order = await prisma.order.findUnique({
    where: { id: orderId.trim() },
    select: {
      id: true,
      displayId: true,
      contactEmail: true,
      currency: true,

      status: true,
      paymentStatus: true,
      paymentIntentId: true,

      subtotal: true,
      shippingTotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,

      promotionId: true,
      promotionCode: true
    }
  });

  if (!order) return bad('ORDER_NOT_FOUND', 404);

  // Block paying again if already paid/captured
  if (order.paymentStatus === 'CAPTURED' || order.status === 'PAID') {
    return bad('ORDER_ALREADY_PAID', 409);
  }

  const currency = normCurrency(order.currency);
  const currencyLower = currency.toLowerCase();

  const amount = Math.max(0, Math.trunc(order.grandTotal ?? 0));
  if (!Number.isInteger(amount) || amount <= 0) {
    return bad('INVALID_ORDER_TOTAL', 400);
  }

  // Single line item ensures Stripe amount matches DB grand total exactly.
  const lineName = order.displayId ? `Prince Foods Order ${order.displayId}` : 'Prince Foods Order';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],

    // internal order id; webhook uses this
    client_reference_id: order.id,

    customer_email: order.contactEmail?.trim() ? order.contactEmail.trim() : undefined,

    line_items: [
      {
        price_data: {
          currency: currencyLower,
          unit_amount: amount,
          product_data: {
            name: lineName,
            description: order.displayId ? `Order ref: ${order.displayId}` : undefined
          }
        },
        quantity: 1
      }
    ],

    success_url: `${siteUrl}/order-confirmation/${order.id}?s=1`,
    cancel_url: `${siteUrl}/checkout?c=1`,

    metadata: {
      orderId: order.id,
      displayId: order.displayId ?? '',
      currency,

      subtotal: String(order.subtotal ?? 0),
      shippingTotal: String(order.shippingTotal ?? 0),
      discountTotal: String(order.discountTotal ?? 0),
      taxTotal: String(order.taxTotal ?? 0),
      grandTotal: String(order.grandTotal ?? 0),

      promotionId: order.promotionId ?? '',
      promotionCode: order.promotionCode ?? ''
    }
  });

  return NextResponse.json({ ok: true, url: session.url });
}
