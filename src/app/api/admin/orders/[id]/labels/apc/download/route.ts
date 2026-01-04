// src/app/api/admin/orders/[id]/labels/apc/download/route.ts

import { prisma } from '@/lib/prisma';
import { apcGetLabelWithPolling, ApcLabelPendingError } from '@/lib/shipping/apc';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: RouteContext) {
  try {
    const { id: orderId } = await ctx.params;

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

    // Use saved label if present
    let mime = shipment.labelMime as string | null;
    let base64 = shipment.labelBase64 as string | null;

    // Otherwise poll APC
    if (!mime || !base64) {
      try {
        const label = await apcGetLabelWithPolling(shipment.waybill, {
          attempts: 30,
          initialDelayMs: 1000,
          abortIfFutureCollectionDate: false
        });

        mime = label.mime;
        base64 = label.base64;

        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { labelMime: mime, labelBase64: base64, status: 'purchased' }
        });
      } catch (e) {
        if (e instanceof ApcLabelPendingError) {
          return NextResponse.json(
            { ok: true, status: 'PENDING_LABEL', waybill: shipment.waybill },
            { status: 202 }
          );
        }
        throw e;
      }
    }

    if (!mime || !base64) {
      return NextResponse.json(
        { ok: false, status: 'ERROR', message: 'Label missing' },
        { status: 500 }
      );
    }

    // ✅ Buffer is valid BodyInit for NextResponse (Node runtime)
    const bytes = Buffer.from(base64, 'base64');

    const filename =
      mime === 'application/pdf'
        ? `apc-${shipment.waybill}.pdf`
        : mime === 'image/png'
          ? `apc-${shipment.waybill}.png`
          : `apc-${shipment.waybill}.zpl`;

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, status: 'ERROR', message }, { status: 500 });
  }
}
