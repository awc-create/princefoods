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
      select: { id: true, orderId: true, status: true }
    });
    if (!rc) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    if (rc.status === 'RESOLVED') {
      return NextResponse.json({ ok: false, error: 'ALREADY_RESOLVED' }, { status: 400 });
    }

    await prisma.returnCase.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedAt: new Date()
      }
    });

    await prisma.orderActivity.create({
      data: {
        orderId: rc.orderId,
        type: 'RETURN_RECEIVED',
        note: 'Return marked as received'
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /returns/[id]/receive failed', e);
    return NextResponse.json({ ok: false, error: 'RECEIVE_FAILED' }, { status: 500 });
  }
}
