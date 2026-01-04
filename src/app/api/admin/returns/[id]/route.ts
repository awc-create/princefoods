import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(ctx);

    const item = await prisma.returnCase.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            items: true,
            shipments: true,
            payments: true,
            activities: { orderBy: { createdAt: 'asc' } }
          }
        },
        shipment: true
      }
    });

    if (!item) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    console.error('GET /api/admin/returns/[id] failed', e);
    return NextResponse.json({ ok: false, error: 'RETURNS_DETAIL_FAILED' }, { status: 500 });
  }
}
