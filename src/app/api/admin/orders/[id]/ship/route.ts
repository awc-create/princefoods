// src/app/api/admin/orders/[id]/ship/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---- Validation ----
const Body = z.object({
  carrier: z.string().min(1, 'carrier is required'),
  service: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional(),
  markFulfilled: z.boolean().optional()
});

// Reusable ctx type (Next 15+): params is a Promise
interface ParamsCtx {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, ctx: ParamsCtx) {
  try {
    const { id: orderId } = await ctx.params; // <- await is required in app routes

    // Parse & validate body (return 400 on validation failure)
    const json = await req.json().catch(() => ({}));
    const body = Body.parse(json);

    // Ensure order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shippingAddress: true }
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    // Create manual shipment
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        carrier: body.carrier,
        service: body.service ?? '',
        trackingNumber: body.trackingNumber ?? '',
        trackingUrl: body.trackingUrl ?? '',
        status: 'purchased'
      },
      select: {
        id: true,
        carrier: true,
        service: true,
        trackingNumber: true,
        trackingUrl: true,
        status: true
      }
    });

    // Optionally mark order fulfilled
    if (body.markFulfilled) {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'FULFILLED' }
      });
    }

    // Activity log
    await prisma.orderActivity.create({
      data: {
        orderId,
        type: 'FULFILLED',
        note: `Shipment saved (${body.carrier}${body.service ? ` • ${body.service}` : ''})`,
        meta: { shipmentId: shipment.id }
      }
    });

    return NextResponse.json({ ok: true, shipment });
  } catch (err) {
    // Zod validation -> 400, everything else -> 500
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request', issues: err.flatten() },
        { status: 400 }
      );
    }

    console.error('Manual ship error:', err);
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
