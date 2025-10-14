import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ orders: [] });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!user) return NextResponse.json({ orders: [] });

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      displayId: true, // 👈 expose short number
      status: true,
      paymentStatus: true,
      grandTotal: true,
      createdAt: true,
      totalWeightGrams: true, // 👈 expose weight
      items: {
        select: {
          id: true,
          name: true,
          quantity: true,
          imageUrl: true
        }
      }
    }
  });

  return NextResponse.json({ orders });
}
