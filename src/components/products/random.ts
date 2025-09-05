import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get('limit') ?? '6', 10);

  const products = await prisma.product.findMany({
    take: limit,
    where: { visible: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      price: true,
      productImageUrl: true
    }
  });

  return NextResponse.json(products);
}
