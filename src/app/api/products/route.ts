// src/app/api/products/route.ts
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_LIMIT = 12;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const collectionParam = (url.searchParams.get('collection') ?? '').trim();
    const searchQuery = (url.searchParams.get('q') ?? '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(
      48,
      parseInt(url.searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
    );
    const skip = (page - 1) * limit;

    // optional price filters (GBP)
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

    // Search query filter — name contains match only
    const searchFilter: Prisma.ProductWhereInput = searchQuery
      ? { name: { contains: searchQuery, mode: 'insensitive' } }
      : {};

    const whereForBounds: Prisma.ProductWhereInput = {
      visible: true,
      ...categoryFilter,
      ...searchFilter
    };

    const where: Prisma.ProductWhereInput = {
      visible: true,
      ...priceFilter,
      ...categoryFilter,
      ...searchFilter
    };

    // Sorting — only customer-facing options accepted
    const sort = (url.searchParams.get('sort') ?? '').toLowerCase();
    let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: 'desc' }];
    switch (sort) {
      case 'best':
        orderBy = [{ unitsSold: 'desc' }, { revenuePence: 'desc' }];
        break;
      case 'price_asc':
        orderBy = [{ price: 'asc' }];
        break;
      case 'price_desc':
        orderBy = [{ price: 'desc' }];
        break;
      case 'newest':
      default:
        orderBy = [{ createdAt: 'desc' }];
    }

    const [total, rows, bounds] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          productImageUrl: true,

          // ✅ offer fields (needed for pills + UI)
          ribbon: true,
          discountMode: true,
          discountValue: true,

          // misc fields
          collection: true,
          inventory: true,
          visible: true,

          // analytics
          views: true,
          clicks: true,
          unitsSold: true,
          revenuePence: true
        }
      }),
      prisma.product.aggregate({
        where: whereForBounds,
        _min: { price: true },
        _max: { price: true }
      })
    ]);

    const coerceInventory = (inv: string | null): number | undefined => {
      if (!inv) return undefined;
      const n = Number(inv);
      return Number.isFinite(n) ? n : undefined;
    };

    const isSpecial = (r: {
      ribbon: string | null;
      discountMode: string | null;
      discountValue: number | null;
    }) =>
      Boolean(
        (r.ribbon && /best|special|hot|deal/i.test(r.ribbon)) ??
        (r.discountMode && r.discountValue && r.discountValue > 0)
      );

    const products = rows.map((r) => ({
      id: r.id,
      title: r.name,
      description: r.description ?? undefined,
      price: r.price ?? 0,

      // ✅ your frontend expects imageUrl (not productImageUrl)
      imageUrl: r.productImageUrl ?? null,

      slug: undefined,
      collection: r.collection ?? undefined,
      inventory: coerceInventory(r.inventory ?? null),
      visible: r.visible ?? true,

      // ✅ keep these for ProductCard pills
      ribbon: r.ribbon ?? null,
      discountMode: r.discountMode ?? null,
      discountValue: r.discountValue ?? null,

      // keep your legacy tag/special too
      tag: r.ribbon ?? undefined,
      special: isSpecial({
        ribbon: r.ribbon ?? null,
        discountMode: r.discountMode ?? null,
        discountValue: r.discountValue ?? null
      }),

      // expose analytics (optional to use in UI)
      views: r.views,
      clicks: r.clicks,
      unitsSold: r.unitsSold,
      revenuePence: r.revenuePence
    }));

    const pageCount = Math.max(1, Math.ceil(total / limit));
    const hasNextPage = page < pageCount;

    // ✅ bounds in GBP (same units as your product price)
    const minPrice = Number(bounds._min.price ?? 0);
    const maxPrice = Number(bounds._max.price ?? 0);

    return NextResponse.json({
      ok: true,
      products,
      page,
      limit,
      total,
      pageCount,
      hasNextPage,
      priceBounds: {
        min: Number.isFinite(minPrice) ? minPrice : 0,
        max: Number.isFinite(maxPrice) ? maxPrice : 0
      }
    });
  } catch (error) {
    console.error('[API /products] Error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
