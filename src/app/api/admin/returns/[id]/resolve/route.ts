import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, _ctx: unknown) {
  const { id } = getParams<{ id: string }>(_ctx);

  try {
    const body = (await req.json().catch(() => ({}))) as { note?: string };
    const note = (body.note ?? '').trim().slice(0, 2000) || null;

    const rc = await prisma.returnCase.findUnique({
      where: { id },
      select: { id: true, orderId: true, status: true }
    });
    if (!rc) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    await prisma.returnCase.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolutionNote: note ?? undefined
      }
    });

    await prisma.orderActivity.create({
      data: {
        orderId: rc.orderId,
        type: 'RETURN_CLOSED',
        note: note ?? 'Return case resolved/closed'
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /returns/[id]/resolve failed', e);
    return NextResponse.json({ ok: false, error: 'RESOLVE_FAILED' }, { status: 500 });
  }
}
