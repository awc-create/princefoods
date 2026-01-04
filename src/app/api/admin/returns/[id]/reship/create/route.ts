import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: Request, _ctx: unknown) {
  const { id } = getParams<{ id: string }>(_ctx);

  try {
    const rc = await prisma.returnCase.findUnique({
      where: { id },
      include: {
        order: { select: { id: true } },
        shipment: { select: { id: true, carrier: true, serviceCode: true } }
      }
    });

    if (!rc) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    if (!rc.orderId) return NextResponse.json({ ok: false, error: 'NO_ORDER' }, { status: 400 });

    if (!rc.shipmentId) {
      return NextResponse.json(
        { ok: false, error: 'NO_ORIGINAL_SHIPMENT_LINKED' },
        { status: 400 }
      );
    }

    // Create a new shipment as a reship
    const newShipment = await prisma.shipment.create({
      data: {
        orderId: rc.orderId,
        carrier: rc.shipment?.carrier ?? 'APC',
        serviceCode: rc.shipment?.serviceCode ?? null,
        status: 'PENDING',
        reshipOfShipmentId: rc.shipmentId
      }
    });

    // Attach the reship shipment to the return case meta (since your ReturnCase now has only shipmentId)
    await prisma.returnCase.update({
      where: { id },
      data: {
        // keep original shipmentId as the failing one
        meta: {
          ...(typeof rc.meta === 'object' && rc.meta ? rc.meta : {}),
          reshipShipmentId: newShipment.id
        }
      }
    });

    await prisma.orderActivity.create({
      data: {
        orderId: rc.orderId,
        type: 'RETURN_RESHIP_CREATED',
        note: 'Reship shipment created',
        meta: { returnCaseId: rc.id, reshipShipmentId: newShipment.id }
      }
    });

    return NextResponse.json({ ok: true, shipmentId: newShipment.id });
  } catch (e) {
    console.error('POST /returns/[id]/reship/create failed', e);
    return NextResponse.json({ ok: false, error: 'RESHIP_CREATE_FAILED' }, { status: 500 });
  }
}
