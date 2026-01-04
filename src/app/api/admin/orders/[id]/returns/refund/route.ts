import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { amountPence?: number; note?: string };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, grandTotal: true, refundQueuedAt: true }
  });

  if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

  const amountPence =
    typeof body.amountPence === 'number' && body.amountPence > 0
      ? Math.floor(body.amountPence)
      : order.grandTotal;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      refundQueuedAt: new Date(),
      refundAmountPence: amountPence
    }
  });

  const rc = await prisma.returnCase.upsert({
    where: { orderId },
    update: {
      status: 'RESOLVED',
      resolution: 'REFUND',
      resolutionNote: body.note ?? undefined,
      resolvedAt: new Date()
    },
    create: {
      orderId,
      status: 'RESOLVED',
      resolution: 'REFUND',
      resolutionNote: body.note ?? undefined,
      resolvedAt: new Date()
    }
  });

  await prisma.orderActivity.create({
    data: {
      orderId,
      type: 'NOTE',
      note: body.note
        ? `Refund queued (£${(amountPence / 100).toFixed(2)}): ${body.note}`
        : `Refund queued (£${(amountPence / 100).toFixed(2)})`,
      meta: { action: 'REFUND_QUEUE', returnCaseId: rc.id, amountPence }
    }
  });

  return NextResponse.json({ ok: true, amountPence });
}
