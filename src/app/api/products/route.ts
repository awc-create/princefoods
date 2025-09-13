import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_LIMIT = 12;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const collectionParam = (url.searchParams.get('collection') ?? '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(
      48,
      parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
    );
    const skip = (page - 1) * limit;

    // optional price filters
    const minStr = url.searchParams.get('min');
    const maxStr = url.searchParams.get('max');
    const min = minStr != null && minStr !== '' ? Number(minStr) : undefined;
    const max = maxStr != null && maxStr !== '' ? Number(maxStr) : undefined;

    const priceFilter: Prisma.ProductWhereInput =
      (min != null && !Number.isNaN(min)) || (max != null && !Number.isNaN(max))
        ? {
            price: {
              ...(min != null && !Number.isNaN(min) ? { gte: min } : {}),
              ...(max != null && !Number.isNaN(max) ? { lte: max } : {})
            }
          }
        : {};

    // Category / collection filter:
    let categoryFilter: Prisma.ProductWhereInput = {};
    if (collectionParam) {
      const slug = collectionParam.toLowerCase();
      const cat = await prisma.category.findUnique({
        where: { slug },
        select: { id: true, parentId: true }
      });

      if (cat) {
        let ids: string[] = [cat.id];
        if (cat.parentId === null) {
          const children = await prisma.category.findMany({
            where: { parentId: cat.id, isActive: true },
            select: { id: true }
          });
          ids = [cat.id, ...children.map((c) => c.id)];
        }
        categoryFilter = { categoryId: { in: ids } };
      } else {
        // fallback to legacy text collection field
        categoryFilter = { collection: { contains: collectionParam, mode: 'insensitive' } };
      }
    }

    const where: Prisma.ProductWhereInput = {
      visible: true,
      ...priceFilter,
      ...categoryFilter
    };

    const [total, rows] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          productImageUrl: true,
          ribbon: true,
          collection: true,
          inventory: true, // string in schema; we’ll coerce if numeric
          visible: true,
          discountMode: true, // to help derive “special”
          discountValue: true
        }
      })
    ]);

    // helper to coerce your inventory string → number (if it’s numeric)
    const coerceInventory = (inv: string | null): number | undefined => {
      if (!inv) return undefined;
      const n = Number(inv);
      return Number.isFinite(n) ? n : undefined;
    };

    // derive "special" (you can tune this)
    const isSpecial = (r: {
      ribbon: string | null;
      discountMode: string | null;
      discountValue: number | null;
    }) =>
      Boolean(
        (r.ribbon && /best|special|hot|deal/i.test(r.ribbon)) ??
          (r.discountMode && r.discountValue && r.discountValue > 0)
      );

    // ✅ normalised to your Product interface
    const products = rows.map((r) => ({
      id: r.id,
      title: r.name,
      description: r.description ?? undefined,
      price: r.price ?? 0,
      imageUrl: r.productImageUrl ?? null,
      slug: undefined, // (add if/when you add a product slug column)
      collection: r.collection ?? undefined,
      inventory: coerceInventory(r.inventory ?? null),
      visible: r.visible ?? true,
      tag: r.ribbon ?? undefined,
      special: isSpecial({
        ribbon: r.ribbon ?? null,
        discountMode: r.discountMode ?? null,
        discountValue: r.discountValue ?? null
      })
    }));

    const pageCount = Math.max(1, Math.ceil(total / limit));
    const hasNextPage = page < pageCount;

    return NextResponse.json({
      ok: true,
      products,
      page,
      limit,
      total,
      pageCount,
      hasNextPage
    });
  } catch (error) {
    console.error('[API /products] Error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
