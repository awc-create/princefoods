// src/app/api/categories/menu/route.ts
/**
 * Category tree for the Shop dropdown.
 *
 * Only returns categories that contain at least one SELLABLE product — in
 * stock, priced and visible (see src/lib/stock.ts). Sending a shopper to a
 * category that renders empty is a dead end, and with 85 items out of stock
 * and some unpriced, that would happen a lot.
 *
 * Nothing is hardcoded: fill in prices and stock in the admin and categories
 * appear here on their own.
 */
import { prisma } from '@/lib/prisma';
import { isSellable } from '@/lib/stock';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface MenuChild {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface MenuParent extends MenuChild {
  children: MenuChild[];
}

export async function GET() {
  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true, parentId: true }
      }),
      // Only the fields needed to decide sellability.
      prisma.product.findMany({
        where: { visible: true, categoryId: { not: null } },
        select: { categoryId: true, inventory: true, price: true }
      })
    ]);

    // Count sellable products per category.
    const sellableByCat = new Map<string, number>();
    for (const p of products) {
      if (!p.categoryId) continue;
      if (!isSellable(p.inventory, p.price)) continue;
      sellableByCat.set(p.categoryId, (sellableByCat.get(p.categoryId) ?? 0) + 1);
    }

    const parents = categories.filter((c) => !c.parentId);
    const childrenOf = (parentId: string) => categories.filter((c) => c.parentId === parentId);

    const tree: MenuParent[] = parents
      .map((parent) => {
        const children: MenuChild[] = childrenOf(parent.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            count: sellableByCat.get(c.id) ?? 0
          }))
          .filter((c) => c.count > 0);

        // A parent counts its own directly-assigned products plus its children's.
        const ownCount = sellableByCat.get(parent.id) ?? 0;
        const count = ownCount + children.reduce((sum, c) => sum + c.count, 0);

        return { id: parent.id, name: parent.name, slug: parent.slug, count, children };
      })
      .filter((p) => p.count > 0);

    return NextResponse.json(
      { ok: true, categories: tree },
      // Cheap to compute, but no need to hit the DB on every hover.
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }
    );
  } catch (e) {
    console.error('[categories/menu]', e);
    // The dropdown degrades to a plain "Shop" link rather than breaking the nav.
    return NextResponse.json({ ok: false, categories: [] }, { status: 500 });
  }
}
