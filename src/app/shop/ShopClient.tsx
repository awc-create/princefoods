// src/app/shop/ShopClient.tsx
'use client';

import CategorySidebar from '@/components/shop/CategorySidebar';
import Pagination from '@/components/shop/Pagination';
import ProductCard from '@/components/shop/ProductCard';
import type { Product } from '@/types/product';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Shop.module.scss';

interface ApiResponse {
  ok?: boolean;
  products?: Product[];
  pageCount?: number;
  priceBounds?: { min: number; max: number };
}

export default function ShopClient({
  initialProducts,
  initialPageCount,
  initialPriceBounds
}: {
  initialProducts: Product[];
  initialPageCount: number;
  initialPriceBounds: { min: number; max: number } | null;
}) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(initialPageCount);

  // ✅ bounds for the slider
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number } | null>(
    initialPriceBounds
  );

  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<string>('newest');

  // ✅ used to control "No products found" messaging
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  // ✅ prevent duplicate fetch on mount (since we already have SSR data)
  const didMountRef = useRef(false);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedSlug) p.set('collection', selectedSlug);
    if (minPrice != null) p.set('min', String(minPrice));
    if (maxPrice != null) p.set('max', String(maxPrice));
    p.set('page', String(page));
    if (sort) p.set('sort', sort);
    return p.toString();
  }, [selectedSlug, minPrice, maxPrice, page, sort]);

  useEffect(() => {
    let cancelled = false;

    // ✅ skip first run because SSR already provided initialProducts
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?${params}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as ApiResponse;
        if (cancelled) return;

        const list = Array.isArray(data.products) ? data.products : [];
        setProducts(list);
        setPageCount(Number(data.pageCount ?? 1));

        // ✅ update slider bounds whenever we fetch (collection changes should affect bounds)
        setPriceBounds(
          data.priceBounds &&
            Number.isFinite(data.priceBounds.min) &&
            Number.isFinite(data.priceBounds.max)
            ? data.priceBounds
            : null
        );

        setHasFetched(true);
      } catch {
        if (!cancelled) {
          setProducts([]);
          setPageCount(1);
          setHasFetched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        <CategorySidebar
          selected={selectedSlug}
          onSelect={(slug) => {
            setSelectedSlug(slug);
            setPage(1);

            // ✅ clear price filter when switching category (optional but usually expected)
            setMinPrice(null);
            setMaxPrice(null);
          }}
          priceBounds={priceBounds}
          currentPrice={{ min: minPrice, max: maxPrice }}
          onPriceChange={(min, max) => {
            setMinPrice(min);
            setMaxPrice(max);
            setPage(1);
          }}
        />

        <div className={styles.products}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>{selectedSlug ? selectedSlug.replace(/-/g, ' ') : 'All Products'}</h2>

            <label style={{ fontSize: 14 }}>
              Sort:&nbsp;
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="newest">Newest</option>
                <option value="best">Best sellers</option>
                <option value="worst">Worst sellers</option>
                <option value="most_clicked">Most clicked</option>
                <option value="least_clicked">Least clicked</option>
                <option value="price_asc">Price ↑</option>
                <option value="price_desc">Price ↓</option>
              </select>
            </label>
          </div>

          {/* ✅ no "Loading products..." text */}
          <div className={styles.productGrid} aria-busy={loading}>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* ✅ Only show after at least one fetch OR if SSR gave empty list */}
          {!loading && (hasFetched || initialProducts.length === 0) && products.length === 0 && (
            <p style={{ color: 'var(--text-muted)' }}>No products found.</p>
          )}

          <div className={styles.paginationWrap}>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}
