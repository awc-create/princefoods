// src/app/shop/ShopClient.tsx
'use client';

import CategorySidebar from '@/components/shop/CategorySidebar';
import Pagination from '@/components/shop/Pagination';
import ProductCard from '@/components/shop/ProductCard';
import type { Product } from '@/types/product';
import { useEffect, useState } from 'react';
import styles from './Shop.module.scss';

interface ApiResponse {
  ok?: boolean;
  products?: Product[];
  pageCount?: number;
}

const DEMO_PRODUCTS: Product[] = [
  {
    id: 'demo-1',
    title: 'Prince Foods Peanut Crunch 200g',
    description: 'Light, crispy, and perfectly roasted peanut crunch — a classic tea-time snack.',
    imageUrl: '/assets/prince-foods-logo.png',
    price: 1.99
  } as Product
];

export default function ShopClient() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSlug) params.set('collection', selectedSlug);
    if (minPrice != null) params.set('min', String(minPrice));
    if (maxPrice != null) params.set('max', String(maxPrice));
    params.set('page', String(page));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as ApiResponse;
        if (cancelled) return;

        const list = Array.isArray(data.products) ? data.products : [];
        setProducts(list);
        setPageCount(Number(data.pageCount ?? 1));
      } catch {
        if (!cancelled) {
          setProducts([]);
          setPageCount(1);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSlug, page, minPrice, maxPrice]);

  const showDemo = products.length === 0;
  const displayProducts = showDemo ? DEMO_PRODUCTS : products;

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        <CategorySidebar
          selected={selectedSlug}
          onSelect={(slug) => {
            setSelectedSlug(slug);
            setPage(1);
          }}
          priceBounds={null}
          currentPrice={{ min: minPrice, max: maxPrice }}
          onPriceChange={(min, max) => {
            setMinPrice(min);
            setMaxPrice(max);
            setPage(1);
          }}
        />

        <div className={styles.products}>
          <h2>{selectedSlug ? selectedSlug.replace(/-/g, ' ') : 'All Products'}</h2>

          <div className={styles.productGrid}>
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {!showDemo && displayProducts.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No products found.</p>
          )}

          {!showDemo && (
            <div className={styles.paginationWrap}>
              <Pagination page={page} pageCount={pageCount} onChange={setPage} />
            </div>
          )}

          {showDemo && (
            <p style={{ marginTop: 12, color: 'var(--text-muted)', fontSize: 13 }}>
              Showing a sample product preview. Add products to the catalog and this will disappear.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
