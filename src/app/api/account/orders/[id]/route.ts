// src/app/api/account/orders/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      status: true,
      paymentStatus: true,
      currency: true,
      subtotal: true,
      shippingTotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          imageUrl: true,
          sku: true
        }
      },
      shippingAddress: true,
      billingAddress: true
    }
  });

  if (!order || order.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ order });
}
