import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const products = await prisma.product.findMany({
    select: { collection: true },
    distinct: ['collection'],
  });

  const categoryMap: Record<string, string[]> = {};

  for (const item of products) {
    if (!item.collection) continue;

    const [parent, child] = item.collection.split(';').map((str) => str.trim());

    if (!categoryMap[parent]) categoryMap[parent] = [];

    if (child && !categoryMap[parent].includes(child)) {
      categoryMap[parent].push(child);
    }
  }

  return NextResponse.json(categoryMap);
}
