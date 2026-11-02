import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export async function GET(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true }
  });

  return NextResponse.json({ order });
}
