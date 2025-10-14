import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });

  return NextResponse.json({ order });
}
