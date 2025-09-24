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

interface Bounds {
  min: number;
  max: number;
}

export default function ShopClient() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  // price slider state
  const [priceBounds, setPriceBounds] = useState<Bounds | null>(null);
  const [currentPrice, setCurrentPrice] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null
  });

  // fetch min/max once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/shop/price-range', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as
        | { ok: true; min: number; max: number }
        | { ok: false };
      if (cancelled) return;
      if (data && 'ok' in data && data.ok) {
        setPriceBounds({ min: data.min, max: data.max });
        // initialize current range to full bounds
        setCurrentPrice({ min: data.min, max: data.max });
      } else {
        setPriceBounds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch products when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedSlug) params.set('collection', selectedSlug);
    if (currentPrice.min != null) params.set('min', String(currentPrice.min));
    if (currentPrice.max != null) params.set('max', String(currentPrice.max));
    params.set('page', String(page));

    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as ApiResponse;
      if (cancelled) return;
      setProducts(data.products ?? []);
      setPageCount(Number(data.pageCount ?? 1));
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSlug, page, currentPrice.min, currentPrice.max]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        <CategorySidebar
          selected={selectedSlug}
          onSelect={(slug) => {
            setSelectedSlug(slug);
            setPage(1);
          }}
          priceBounds={priceBounds}
          currentPrice={currentPrice}
          onPriceChange={(min, max) => {
            setCurrentPrice({ min, max });
            setPage(1);
          }}
        />

        <div className={styles.products}>
          <h2>{selectedSlug ? selectedSlug.replace(/-/g, ' ') : 'All Products'}</h2>

          <div className={styles.productGrid}>
            {products.length ? (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={(id, qty) => {
                    // integrate with your cart/store here
                    console.log('ADD', id, qty);
                  }}
                />
              ))
            ) : (
              <p>No products found.</p>
            )}
          </div>

          <div className={styles.paginationWrap}>
            <Pagination page={page} pageCount={pageCount} onChange={setPage} />
          </div>
        </div>
      </div>
    </div>
  );
}
