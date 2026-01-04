import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReturnResolution = 'RESHIP' | 'REFUND' | 'STORE_CREDIT' | 'CUSTOMER_COLLECT' | 'NO_ACTION';

export async function POST(req: Request, _ctx: unknown) {
  const { id } = getParams<{ id: string }>(_ctx);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      resolution?: ReturnResolution;
      note?: string;
      refundAmountPence?: number;
    };

    const resolution = body.resolution;
    if (!resolution) {
      return NextResponse.json({ ok: false, error: 'RESOLUTION_REQUIRED' }, { status: 400 });
    }

    const rc = await prisma.returnCase.findUnique({
      where: { id },
      select: { id: true, orderId: true, status: true }
    });
    if (!rc) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    if (rc.status === 'RESOLVED') {
      return NextResponse.json({ ok: false, error: 'ALREADY_RESOLVED' }, { status: 400 });
    }

    const note = (body.note ?? '').trim().slice(0, 2000) || null;

    await prisma.returnCase.update({
      where: { id },
      data: {
        resolution,
        resolutionNote: note
      }
    });

    // activity mapping (your ActivityType enum supports these)
    if (resolution === 'REFUND') {
      await prisma.orderActivity.create({
        data: {
          orderId: rc.orderId,
          type: 'RETURN_DECIDED_REFUND',
          note: note ?? 'Return decision: refund',
          meta: body.refundAmountPence ? { refundAmountPence: body.refundAmountPence } : undefined
        }
      });
    } else if (resolution === 'STORE_CREDIT') {
      await prisma.orderActivity.create({
        data: {
          orderId: rc.orderId,
          type: 'RETURN_DECIDED_STORE_CREDIT',
          note: note ?? 'Return decision: store credit'
        }
      });
    } else if (resolution === 'RESHIP') {
      await prisma.orderActivity.create({
        data: {
          orderId: rc.orderId,
          type: 'RETURN_RESHIP_CREATED',
          note: note ?? 'Return decision: reship'
        }
      });
    } else {
      await prisma.orderActivity.create({
        data: { orderId: rc.orderId, type: 'NOTE', note: `Return resolution set: ${resolution}` }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /returns/[id]/decide failed', e);
    return NextResponse.json({ ok: false, error: 'DECIDE_FAILED' }, { status: 500 });
  }
}
