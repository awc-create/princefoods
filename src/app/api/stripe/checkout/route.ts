export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-09-30.clover'
});

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: 'NO_STRIPE_KEY' }, { status: 400 });
  }

  const { lines, orderId } = (await req.json()) as {
    orderId: string;
    lines: { name: string; unit_amount: number; quantity: number }[];
  };

  if (!orderId || !Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lines.map((l) => ({
      price_data: {
        currency: 'gbp',
        unit_amount: l.unit_amount, // pence
        product_data: { name: l.name }
      },
      quantity: l.quantity
    })),
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order-confirmation/${orderId}?s=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout?c=1`,
    metadata: { orderId }
  });

  return NextResponse.json({ ok: true, url: session.url });
}
