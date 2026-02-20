// src/app/shop/page.tsx
import { prisma } from '@/lib/prisma';
import type { Product } from '@/types/product';
import { Suspense } from 'react';
import ShopClient from './ShopClient';

export const metadata = {
  title: 'Shop',
  description: 'Browse products from Prince Foods.'
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function ShopFallback() {
  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 24
        }}
      >
        <div style={{ height: 320, background: '#111', borderRadius: 12, opacity: 0.6 }} />
        <div>
          <div
            style={{
              height: 28,
              width: 180,
              background: '#111',
              borderRadius: 8,
              marginBottom: 16,
              opacity: 0.6
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 16
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{ height: 220, background: '#111', borderRadius: 12, opacity: 0.6 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function getInitialData(): Promise<{
  initialProducts: Product[];
  initialPageCount: number;
  initialPriceBounds: { min: number; max: number } | null;
}> {
  // must match your API default page size (looks like 12)
  const limit = 12;
  const page = 1;
  const skip = (page - 1) * limit;

  const [total, rows, agg] = await Promise.all([
    prisma.product.count({ where: { visible: true } }),
    prisma.product.findMany({
      where: { visible: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        productImageUrl: true,
        ribbon: true,
        discountMode: true,
        discountValue: true
      }
    }),
    prisma.product.aggregate({
      where: { visible: true, price: { not: null } },
      _min: { price: true },
      _max: { price: true }
    })
  ]);

  const initialProducts: Product[] = rows.map((p) => ({
    id: p.id,
    title: p.name,
    description: p.description ?? undefined,
    price: typeof p.price === 'number' ? p.price : 0,
    imageUrl: p.productImageUrl ?? null,
    ribbon: p.ribbon ?? null,
    discountMode: p.discountMode ?? null,
    discountValue: typeof p.discountValue === 'number' ? p.discountValue : null
  }));

  const pageCount = Math.max(1, Math.ceil(total / limit));

  const min = typeof agg._min.price === 'number' ? agg._min.price : null;
  const max = typeof agg._max.price === 'number' ? agg._max.price : null;

  const initialPriceBounds =
    min != null && max != null && Number.isFinite(min) && Number.isFinite(max)
      ? { min, max }
      : null;

  return { initialProducts, initialPageCount: pageCount, initialPriceBounds };
}

export default async function ShopPage() {
  const { initialProducts, initialPageCount, initialPriceBounds } = await getInitialData();

  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopClient
        initialProducts={initialProducts}
        initialPageCount={initialPageCount}
        initialPriceBounds={initialPriceBounds}
      />
    </Suspense>
  );
}
