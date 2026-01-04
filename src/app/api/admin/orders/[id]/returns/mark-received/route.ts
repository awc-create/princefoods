// src/app/api/admin/orders/[id]/returns/mark-received/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { note?: string };

  const updated = await prisma.returnCase.upsert({
    where: { orderId },
    update: {
      status: 'RECEIVED',
      receivedAt: new Date(),
      resolutionNote: body.note ?? undefined
    },
    create: {
      orderId,
      status: 'RECEIVED',
      receivedAt: new Date(),
      resolutionNote: body.note ?? undefined
    }
  });

  await prisma.orderActivity.create({
    data: {
      orderId,
      type: 'NOTE',
      note: body.note ? `Return received: ${body.note}` : 'Return received',
      meta: { returnCaseId: updated.id, action: 'MARK_RECEIVED' }
    }
  });

  return NextResponse.json({ ok: true, returnCase: updated });
}
