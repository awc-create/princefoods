import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

type CatOut = {
  name: string;
  slug: string;
  count: number;
  children: { name: string; slug: string; count: number }[];
};

export async function GET() {
  try {
    // parents + children + direct product counts
    const parents = await prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { products: true } }, // direct products on the parent
        children: {
          where: { isActive: true },
          orderBy: [{ position: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { products: true } }, // direct products on the child
          },
        },
      },
    });

    const result: CatOut[] = parents
      .map((p) => {
        const childWithCounts = p.children
          .map((c) => ({
            name: c.name,
            slug: c.slug,
            count: c._count.products,
          }))
          .filter((c) => c.count > 0);

        const total =
          p._count.products + childWithCounts.reduce((a, b) => a + b.count, 0);

        if (total <= 0) return null; // hide parents with zero (parent + children) products

        return {
          name: p.name,
          slug: p.slug,
          count: total,
          children: childWithCounts,
        };
      })
      .filter(Boolean) as CatOut[];

    return NextResponse.json({ categories: result });
  } catch (e) {
    console.error('[api/shop/categories] failed', e);
    return NextResponse.json({ categories: [] }, { status: 500 });
  }
}
