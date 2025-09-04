import prisma from '@/lib/prisma';
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

    const minStr = url.searchParams.get('min');
    const maxStr = url.searchParams.get('max');
    const min = minStr != null && minStr !== '' ? Number(minStr) : undefined;
    const max = maxStr != null && maxStr !== '' ? Number(maxStr) : undefined;

    const priceFilter =
      (min != null && !Number.isNaN(min)) || (max != null && !Number.isNaN(max))
        ? {
            price: {
              ...(min != null && !Number.isNaN(min) ? { gte: min } : {}),
              ...(max != null && !Number.isNaN(max) ? { lte: max } : {})
            }
          }
        : {};

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
            where: { parentId: cat.id },
            select: { id: true }
          });
          ids = [cat.id, ...children.map((c) => c.id)];
        }
        categoryFilter = { categoryId: { in: ids } };
      } else {
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
          price: true,
          productImageUrl: true,
          ribbon: true
        }
      })
    ]);

    const pageCount = Math.max(1, Math.ceil(total / limit));
    const hasNextPage = page < pageCount;

    const products = rows.map((p) => ({
      id: p.id,
      title: p.name,
      price: p.price ?? 0,
      imageUrl: p.productImageUrl ?? null,
      tag: p.ribbon ?? null
    }));

    return NextResponse.json({
      ok: true,
      products,
      page,
      limit,
      total,
      pageCount,
      hasNextPage
    });
  } catch (error: unknown) {
    console.error('[API /products] Error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
