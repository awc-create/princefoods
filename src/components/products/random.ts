// src/app/api/products/route.ts
import { prisma } from '@/lib/prisma';
import { urlFrom } from '@/lib/url';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  // ✅ Use safe helper instead of raw new URL()
  const requestUrl = urlFrom(req.url);
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
