// src/app/api/products/route.ts
import { absUrl } from '@/lib/abs-url';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // Parse request URL safely
  const requestUrl = new URL(req.url, absUrl('/')); // ensures a base exists
  const limit = parseInt(requestUrl.searchParams.get('limit') ?? '6', 10);

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
