'use client';

import CategorySidebar from '@/components/shop/CategorySidebar';
import Pagination from '@/components/shop/Pagination';
import ProductCard from '@/components/shop/ProductCard';
import type { Product as Prod } from '@/types/product';
import { useEffect, useState } from 'react';
import styles from './Shop.module.scss';

interface ApiProduct {
  id: string;
  title?: string;
  name?: string;
  price?: number | null;
  imageUrl?: string | null;
  productImageUrl?: string | null;
  tag?: string | null;
}

interface ApiResponse {
  ok?: boolean;
  products?: ApiProduct[];
  pageCount?: number;
}

export default function ShopClient() {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [products, setProducts] = useState<Prod[]>([]);
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

    (async () => {
      const res = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as unknown as ApiResponse;

      const list = Array.isArray(data?.products) ? data.products : [];
      const normalized: Prod[] = list.map(
        (p): Prod => ({
          id: String(p.id),
          title: p.title ?? p.name ?? '(untitled)',
          price: Number(p.price ?? 0),
          imageUrl: p.imageUrl ?? p.productImageUrl ?? null,
          tag: p.tag ?? undefined // normalize null -> undefined
        })
      );

      setProducts(normalized);
      setPageCount(Number(data?.pageCount ?? 1));
    })();
  }, [selectedSlug, page, minPrice, maxPrice]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        <CategorySidebar
          selected={selectedSlug}
          onSelect={(slug) => {
            setSelectedSlug(slug);
            setPage(1);
          }}
          onPriceFilterChange={(min, max) => {
            setMinPrice(min);
            setMaxPrice(max);
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
