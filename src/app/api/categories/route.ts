// src/app/api/categories/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cats = await prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, parentId: true, position: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }]
    });

    const counts = await prisma.product.groupBy({
      by: ['categoryId'],
      where: { visible: true, categoryId: { not: null } },
      _count: { categoryId: true }
    });

    const countMap = new Map<string, number>();
    for (const row of counts) {
      if (row.categoryId) countMap.set(row.categoryId, row._count.categoryId);
    }

    const parents = cats.filter((c) => c.parentId === null);
    const byParent = new Map<string, typeof cats>();
    for (const p of parents) byParent.set(p.id, []);
    for (const c of cats)
      if (c.parentId && byParent.has(c.parentId)) byParent.get(c.parentId)!.push(c);

    const payload = parents.map((p) => {
      const children = (byParent.get(p.id) ?? []).map((ch) => ({
        name: ch.name,
        slug: ch.slug,
        count: countMap.get(ch.id) ?? 0
      }));

      const parentSelfCount = countMap.get(p.id) ?? 0;
      const childrenSum = children.reduce((acc, cur) => acc + cur.count, 0);

      return {
        name: p.name,
        slug: p.slug,
        count: parentSelfCount + childrenSum,
        children
      };
    });

    return NextResponse.json({ ok: true, categories: payload });
  } catch (err) {
    console.error('[API /shop/categories] Error:', err);
    return NextResponse.json({ ok: false, categories: [] }, { status: 500 });
  }
}
