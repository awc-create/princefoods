// src/app/api/admin/orders/[id]/returns/[returnId]/receive/route.ts
import { Activity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { NextResponse, type NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; returnId: string }> }
) {
  const { id: orderId, returnId } = await ctx.params;

  const rc = await prisma.returnCase.findFirst({ where: { id: returnId, orderId } });
  if (!rc) return NextResponse.json({ ok: false, error: 'Return case not found' }, { status: 404 });

  const updated = await prisma.returnCase.update({
    where: { id: returnId },
    data: {
      status: 'RECEIVED',
      receivedAt: rc.receivedAt ?? new Date()
    }
  });

  await Activity.returnReceived(orderId, {
    returnCaseId: returnId
  });

  return NextResponse.json({ ok: true, returnCase: updated });
}
