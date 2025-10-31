// src/app/api/admin/orders/[id]/unarchive/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, _ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(_ctx);

    const order = await prisma.order.update({
      where: { id },
      data: { archivedAt: null },
      select: { id: true }
    });

    await prisma.orderActivity.create({
      data: { orderId: order.id, type: 'NOTE', note: 'Unarchived' }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Unarchive order failed:', error);
    return NextResponse.json({ ok: false, error: 'UNARCHIVE_FAILED' }, { status: 500 });
  }
}
