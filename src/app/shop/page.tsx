// src/app/shop/page.tsx
import type { Product } from '@/types/product';
import { Suspense } from 'react';
import ShopClient from './ShopClient';

export const metadata = {
  title: 'Shop',
  description: 'Browse products from Prince Foods.'
};

// Helps ensure runtime fetching and avoids accidental static export
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function ShopFallback() {
  // Simple skeleton; keep inline so we don’t need extra CSS
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

interface ProductsApiShape {
  ok?: boolean;
  products?: unknown;
  pageCount?: unknown;
  priceBounds?: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object';

function toProductArray(v: unknown): Product[] {
  if (!Array.isArray(v)) return [];

  const out: Product[] = [];

  for (const it of v) {
    if (!isObj(it)) continue;

    const rec = it as Record<string, unknown>;

    const id = typeof rec.id === 'string' ? rec.id : '';
    const title =
      typeof rec.title === 'string' ? rec.title : typeof rec.name === 'string' ? rec.name : '';

    const price = typeof rec.price === 'number' && Number.isFinite(rec.price) ? rec.price : 0;

    const description = typeof rec.description === 'string' ? rec.description : undefined;

    const imageUrl =
      typeof rec.imageUrl === 'string' ? rec.imageUrl : rec.imageUrl === null ? null : null;

    if (!id || !title) continue;

    // Construct a safe Product object (no casting, no spreading unknown)
    const p: Product = {
      id,
      title,
      price,
      imageUrl,
      description
    } as Product;

    out.push(p);
  }

  return out;
}

function toPriceBounds(v: unknown): { min: number; max: number } | null {
  if (!isObj(v)) return null;
  const min = typeof v.min === 'number' ? v.min : NaN;
  const max = typeof v.max === 'number' ? v.max : NaN;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function baseUrl() {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  const vercel = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
    : '';
  return site ?? vercel ?? 'http://localhost:3000';
}

async function getInitialData(): Promise<{
  initialProducts: Product[];
  initialPageCount: number;
  initialPriceBounds: { min: number; max: number } | null;
}> {
  try {
    const url = `${baseUrl()}/api/products?page=1&sort=newest`;

    const res = await fetch(url, { cache: 'no-store' });
    const json = (await res.json().catch(() => ({}))) as ProductsApiShape;

    if (!res.ok || !json?.ok) {
      return { initialProducts: [], initialPageCount: 1, initialPriceBounds: null };
    }

    const initialProducts = toProductArray(json.products);
    const initialPageCount =
      typeof json.pageCount === 'number' && Number.isFinite(json.pageCount) ? json.pageCount : 1;

    const initialPriceBounds = toPriceBounds(json.priceBounds);

    return { initialProducts, initialPageCount, initialPriceBounds };
  } catch {
    return { initialProducts: [], initialPageCount: 1, initialPriceBounds: null };
  }
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
