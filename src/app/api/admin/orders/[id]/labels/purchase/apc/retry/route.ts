// src/app/api/admin/orders/[id]/labels/purchase/apc/retry/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { apcGetLabelWithPolling, ApcLabelPendingError } from '@/lib/shipping/apc';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, ctx: RouteContext) {
  try {
    const { id: orderId } = await ctx.params;

    // Find latest APC shipment for this order
    const shipment = await prisma.shipment.findFirst({
      where: { orderId, carrier: 'APC Overnight' },
      orderBy: { createdAt: 'desc' }
    });

    if (!shipment?.waybill) {
      return NextResponse.json(
        { ok: false, status: 'ERROR', message: 'No APC shipment/waybill found' },
        { status: 400 }
      );
    }

    // Already have label
    if (shipment.labelBase64 && shipment.labelMime) {
      return NextResponse.json(
        {
          ok: true,
          status: 'READY',
          waybill: shipment.waybill,
          labelMime: shipment.labelMime,
          labelBase64: shipment.labelBase64
        },
        { status: 200 }
      );
    }

    try {
      const label = await apcGetLabelWithPolling(shipment.waybill, {
        attempts: 40,
        initialDelayMs: 1500,
        abortIfFutureCollectionDate: false
      });

      const updated = await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          labelMime: label.mime,
          labelBase64: label.base64,
          status: 'LABEL_READY'
        }
      });

      // ✅ Activity
      await Activity.labelPurchased(orderId, {
        carrier: 'APC Overnight',
        waybill: updated.waybill,
        shipmentId: updated.id,
        labelMime: updated.labelMime
      });

      return NextResponse.json(
        {
          ok: true,
          status: 'READY',
          waybill: updated.waybill,
          labelMime: updated.labelMime,
          labelBase64: updated.labelBase64
        },
        { status: 200 }
      );
    } catch (e) {
      if (e instanceof ApcLabelPendingError) {
        return NextResponse.json(
          {
            ok: true,
            status: 'PENDING_LABEL',
            waybill: shipment.waybill,
            message: 'Still pending.'
          },
          { status: 202 }
        );
      }
      throw e;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, status: 'ERROR', message }, { status: 500 });
  }
}
