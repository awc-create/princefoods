// src/app/shop/ShopClient.tsx
'use client';

import CategorySidebar from '@/components/shop/CategorySidebar';
import Pagination from '@/components/shop/Pagination';
import ProductCard from '@/components/shop/ProductCard';
import type { Product } from '@/types/product';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Shop.module.scss';

type DealMeta =
  | { mode: 'PERCENT_OFF'; percent: number }
  | { mode: 'AMOUNT_OFF'; amountPence: number }
  | null;

interface ApiResponse {
  ok?: boolean;
  products?: Product[];
  pageCount?: number;
  total?: number;
  priceBounds?: { min: number; max: number };
}

interface BadgesResponse {
  ok?: boolean;
  badges?: Record<string, string[]>;
  deals?: Record<string, DealMeta>;
}

// Only customer-facing sort options
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'best', label: 'Best sellers' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' }
] as const;

export default function ShopClient({
  initialProducts,
  initialPageCount,
  initialPriceBounds
}: {
  initialProducts: Product[];
  initialPageCount: number;
  initialPriceBounds: { min: number; max: number } | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  // ── Read initial state from URL ──────────────────────────────────────
  const [selectedSlug, setSelectedSlug] = useState<string | null>(sp?.get('collection') ?? null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(sp?.get('q') ?? '');
  const [page, setPage] = useState(Number(sp?.get('page') ?? 1));
  const [sort, setSort] = useState(sp?.get('sort') ?? 'newest');
  const [minPrice, setMinPrice] = useState<number | null>(
    sp?.get('min') != null && sp.get('min') !== '' ? Number(sp.get('min')) : null
  );
  const [maxPrice, setMaxPrice] = useState<number | null>(
    sp?.get('max') != null && sp.get('max') !== '' ? Number(sp.get('max')) : null
  );

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [pageCount, setPageCount] = useState(initialPageCount);
  const [total, setTotal] = useState<number | null>(null);
  const [priceBounds, setPriceBounds] = useState<{ min: number; max: number } | null>(
    initialPriceBounds
  );
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [fallbackProducts, setFallbackProducts] = useState<Product[]>([]);
  const [badgesById, setBadgesById] = useState<Record<string, string[]>>({});
  const [dealsById, setDealsById] = useState<Record<string, DealMeta>>({});

  const didMountRef = useRef(false);

  // ── Sync state → URL ─────────────────────────────────────────────────
  const pushUrl = useCallback(
    (overrides: {
      collection?: string | null;
      page?: number;
      sort?: string;
      min?: number | null;
      max?: number | null;
      q?: string;
    }) => {
      const params = new URLSearchParams();
      const col = 'collection' in overrides ? overrides.collection : selectedSlug;
      const pg = 'page' in overrides ? overrides.page : page;
      const srt = 'sort' in overrides ? overrides.sort : sort;
      const mn = 'min' in overrides ? overrides.min : minPrice;
      const mx = 'max' in overrides ? overrides.max : maxPrice;
      const q = 'q' in overrides ? overrides.q : searchQuery;

      if (col) params.set('collection', col);
      if (pg && pg > 1) params.set('page', String(pg));
      if (srt && srt !== 'newest') params.set('sort', srt);
      if (mn != null) params.set('min', String(mn));
      if (mx != null) params.set('max', String(mx));
      if (q) params.set('q', q);

      const qs = params.toString();
      router.replace(qs ? `/shop?${qs}` : '/shop', { scroll: false });
    },
    [router, selectedSlug, page, sort, minPrice, maxPrice, searchQuery]
  );

  // ── API query params ─────────────────────────────────────────────────
  const apiParams = useMemo(() => {
    const p = new URLSearchParams();
    if (selectedSlug) p.set('collection', selectedSlug);
    if (searchQuery) p.set('q', searchQuery);
    if (minPrice != null) p.set('min', String(minPrice));
    if (maxPrice != null) p.set('max', String(maxPrice));
    p.set('page', String(page));
    if (sort) p.set('sort', sort);
    return p.toString();
  }, [selectedSlug, searchQuery, minPrice, maxPrice, page, sort]);

  // ── Fetch products ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!didMountRef.current) {
      didMountRef.current = true;
      if (
        initialProducts.length > 0 &&
        !selectedSlug &&
        !minPrice &&
        !maxPrice &&
        page === 1 &&
        sort === 'newest'
      )
        return;
    }

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/products?${apiParams}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as ApiResponse;
        if (cancelled) return;

        const list = Array.isArray(data.products) ? data.products : [];
        setProducts(list);
        setPageCount(Number(data.pageCount ?? 1));
        setTotal(typeof data.total === 'number' ? data.total : null);
        setPriceBounds(
          data.priceBounds &&
            Number.isFinite(data.priceBounds.min) &&
            Number.isFinite(data.priceBounds.max)
            ? data.priceBounds
            : null
        );
        setHasFetched(true);

        // If search returned nothing, load popular products as fallback
        const isSearch = apiParams.includes('q=');
        if (list.length === 0 && isSearch) {
          try {
            const fallbackRes = await fetch(`/api/products?sort=best&limit=4`, {
              cache: 'no-store'
            });
            const fallbackData = (await fallbackRes.json().catch(() => ({}))) as ApiResponse;
            if (!cancelled)
              setFallbackProducts(
                Array.isArray(fallbackData.products) ? fallbackData.products.slice(0, 4) : []
              );
          } catch {
            /* silent */
          }
        } else {
          setFallbackProducts([]);
        }
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
  }, [apiParams, initialProducts.length, selectedSlug, minPrice, maxPrice, page, sort]);

  // ── Fetch offer badges ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const ids = products.map((p) => p.id).filter(Boolean);
    if (!ids.length) {
      setBadgesById({});
      setDealsById({});
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/offers/badges', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: ids })
        });
        const data = (await res.json().catch(() => ({}))) as BadgesResponse;
        if (cancelled) return;
        setBadgesById(data.badges ?? {});
        setDealsById(data.deals ?? {});
      } catch {
        if (!cancelled) {
          setBadgesById({});
          setDealsById({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [products]);

  // ── Heading label ────────────────────────────────────────────────────
  const headingLabel = useMemo(() => {
    if (searchQuery) return `Results for "${searchQuery}"`;
    if (!selectedSlug) return 'All Products';
    return selectedName ?? selectedSlug.replace(/-/g, ' ');
  }, [selectedSlug, selectedName, searchQuery]);

  // Sync when URL changes externally (e.g. new search from navbar)
  const spQ = sp?.get('q') ?? '';
  useEffect(() => {
    setSearchQuery(spQ);
    if (spQ) {
      setPage(1);
      setSelectedSlug(null);
      setSelectedName(null);
    }
  }, [spQ]);

  const countLabel = total != null ? ` (${total})` : '';

  return (
    <div className={styles.wrapper}>
      <div className={styles.grid}>
        <CategorySidebar
          selected={selectedSlug}
          onSelect={(slug, name) => {
            setSelectedSlug(slug);
            setSelectedName(name ?? null);
            setPage(1);
            setMinPrice(null);
            setMaxPrice(null);
            pushUrl({ collection: slug, page: 1, min: null, max: null });
          }}
          priceBounds={priceBounds}
          currentPrice={{ min: minPrice, max: maxPrice }}
          onPriceChange={(min, max) => {
            setMinPrice(min);
            setMaxPrice(max);
            setPage(1);
            pushUrl({ min, max, page: 1 });
          }}
        />

        <div className={styles.products}>
          <div className={styles.topRow}>
            <h2>
              {headingLabel}
              <span
                style={{
                  fontWeight: 400,
                  fontSize: '0.85em',
                  color: 'var(--text-muted)',
                  marginLeft: 6
                }}
              >
                {countLabel}
              </span>
            </h2>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                    pushUrl({ q: '', page: 1 });
                  }}
                  style={{
                    fontSize: 13,
                    color: 'var(--primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Clear search
                </button>
              )}
              <label className={styles.sortLabel}>
                Sort:&nbsp;
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                    pushUrl({ sort: e.target.value, page: 1 });
                  }}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Loading skeleton overlay */}
          {loading ? (
            <div className={styles.skeletonGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard} />
              ))}
            </div>
          ) : (
            <div className={styles.productGrid}>
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  promoBadges={badgesById[product.id] ?? []}
                  deal={dealsById[product.id] ?? null}
                />
              ))}
            </div>
          )}

          {!loading && (hasFetched || initialProducts.length === 0) && products.length === 0 && (
            <div style={{ marginTop: 32 }}>
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 24px',
                  background: '#fafafa',
                  borderRadius: 16,
                  border: '1px solid #f0ede6',
                  marginBottom: 40
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem', color: 'var(--text-dark)' }}>
                  No results for &ldquo;{searchQuery}&rdquo;
                </h3>
                <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                  We couldn&apos;t find any products matching that name. Try a different spelling or
                  browse our popular picks below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                    pushUrl({ q: '', page: 1 });
                  }}
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '9px 20px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: 'pointer'
                  }}
                >
                  Browse all products
                </button>
              </div>

              {fallbackProducts.length > 0 && (
                <>
                  <h3
                    style={{
                      fontWeight: 700,
                      fontSize: '1rem',
                      color: 'var(--text-dark)',
                      marginBottom: 16
                    }}
                  >
                    Popular picks
                  </h3>
                  <div className={styles.productGrid}>
                    {fallbackProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        promoBadges={[]}
                        deal={null}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className={styles.paginationWrap}>
            <Pagination
              page={page}
              pageCount={pageCount}
              onChange={(p) => {
                setPage(p);
                pushUrl({ page: p });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
