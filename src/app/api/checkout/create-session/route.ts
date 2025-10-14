// src/app/api/checkout/create-session/route.ts
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = (await req.json()) as { orderId: string };
    if (!orderId) return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const secret = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secret) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    const stripe = new Stripe(secret);

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((it) => ({
      quantity: it.quantity,
      price_data: {
        currency: order.currency.toLowerCase(),
        unit_amount: it.unitPrice,
        product_data: {
          name: it.name,
          ...(it.imageUrl ? { images: [it.imageUrl] } : {}),
          ...(it.sku ? { metadata: { sku: it.sku } } : {})
        }
      }
    }));

    const base = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: order.id, // 👈 critical
      customer_email: order.contactEmail,
      success_url: `${base}/checkout/success?o=${order.displayId}`,
      cancel_url: `${base}/checkout?cancel=1`,
      line_items,
      metadata: {
        orderId: order.id,
        displayId: order.displayId
      },
      payment_intent_data: {
        metadata: {
          orderId: order.id,
          displayId: order.displayId
        }
      }
    });

    // Save the session id so webhook can also match via paymentRef
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentRef: session.id, paymentProvider: 'stripe' }
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (e) {
    console.error('[create-session] error', e);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
