// src/app/api/account/orders/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    return NextResponse.json({ ok: false, error: 'Unauthenticated', orders: [] }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: 'Unauthenticated', orders: [] }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: user.id }, { contactEmail: email }]
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      displayId: true,
      status: true,
      paymentStatus: true,
      grandTotal: true,
      createdAt: true,
      totalWeightGrams: true,
      items: {
        select: { id: true, name: true, quantity: true, imageUrl: true }
      }
    }
  });

  return NextResponse.json({ ok: true, orders }, { status: 200 });
}
