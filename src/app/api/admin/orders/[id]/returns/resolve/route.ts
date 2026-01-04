import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

type Resolution = 'RESHIP' | 'REFUND' | 'STORE_CREDIT' | 'CUSTOMER_COLLECT' | 'NO_ACTION';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;
  const body = (await req.json()) as { resolution: Resolution; note?: string };

  const updated = await prisma.returnCase.upsert({
    where: { orderId },
    update: {
      status: 'RESOLVED',
      resolution: body.resolution,
      resolutionNote: body.note ?? undefined,
      resolvedAt: new Date()
    },
    create: {
      orderId,
      status: 'RESOLVED',
      resolution: body.resolution,
      resolutionNote: body.note ?? undefined,
      resolvedAt: new Date()
    }
  });

  await prisma.orderActivity.create({
    data: {
      orderId,
      type: 'NOTE',
      note: body.note
        ? `Return resolved (${body.resolution}): ${body.note}`
        : `Return resolved (${body.resolution})`,
      meta: { returnCaseId: updated.id, action: 'RESOLVE', resolution: body.resolution }
    }
  });

  return NextResponse.json({ ok: true, returnCase: updated });
}
