// src/components/shop/CategorySidebar.tsx
'use client';

import RangeSlider from '@/components/slider/RangeSlider';
import { useEffect, useMemo, useState } from 'react';
import styles from './CategorySidebar.module.scss';

interface Child {
  name: string;
  slug: string;
  count: number;
}
interface Parent {
  name: string;
  slug: string;
  count: number;
  children: Child[];
}

export default function CategorySidebar({
  selected,
  onSelect,
  priceBounds,
  currentPrice,
  onPriceChange
}: {
  selected: string | null;
  onSelect: (slug: string | null) => void;
  priceBounds: { min: number; max: number } | null;
  currentPrice: { min: number | null; max: number | null };
  onPriceChange: (min: number | null, max: number | null) => void;
}) {
  const [cats, setCats] = useState<Parent[]>([]);
  const [openParent, setOpenParent] = useState<string | null>(null);

  // ✅ local slider state (dragging does NOT trigger fetch)
  const [draftPrice, setDraftPrice] = useState<{ min: number | null; max: number | null }>({
    min: null,
    max: null
  });

  // Fetch category tree
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/shop/categories', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({ categories: [] }))) as {
        categories?: unknown;
      };
      if (cancelled) return;

      setCats(Array.isArray(data.categories) ? (data.categories as Parent[]) : []);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Expand correct parent
  useEffect(() => {
    if (!selected) {
      setOpenParent(null);
      return;
    }
    const asParent = cats.find((p) => p.slug === selected);
    if (asParent) {
      setOpenParent(asParent.slug);
      return;
    }
    const parentOfChild = cats.find((p) => p.children.some((c) => c.slug === selected));
    if (parentOfChild) setOpenParent(parentOfChild.slug);
  }, [selected, cats]);

  // bounds
  const minLimit = useMemo(() => (priceBounds ? Math.floor(priceBounds.min) : 0), [priceBounds]);
  const maxLimit = useMemo(() => {
    if (!priceBounds) return 0;
    const mn = Math.floor(priceBounds.min);
    const mx = Math.ceil(priceBounds.max);
    return Math.max(mx, mn);
  }, [priceBounds]);

  // sync draft when parent filter changes (or bounds change)
  useEffect(() => {
    setDraftPrice({
      min: currentPrice.min,
      max: currentPrice.max
    });
  }, [currentPrice.min, currentPrice.max, minLimit, maxLimit]);

  const minVal = draftPrice.min ?? minLimit;
  const maxVal = draftPrice.max ?? maxLimit;

  const currency = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

  const parentsOnly = useMemo(() => cats, [cats]);

  const sliderDisabled = maxLimit <= minLimit;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.headerRow}>
        <h3>Categories</h3>
        <button
          className={`${styles.allBtn} ${!selected ? styles.active : ''}`}
          onClick={() => {
            onSelect(null);
            setOpenParent(null);
          }}
          aria-pressed={!selected}
          title="Display all products"
        >
          Display all
        </button>
      </div>

      <nav className={styles.nav} aria-label="Product categories">
        {parentsOnly.map((p) => {
          const isOpen = openParent === p.slug;
          const isSelectedParent = selected === p.slug;
          return (
            <div key={p.slug} className={styles.group}>
              <button
                className={`${styles.parent} ${isSelectedParent ? styles.active : ''} ${
                  isOpen ? styles.open : ''
                }`}
                onClick={() => {
                  onSelect(p.slug);
                  setOpenParent(p.slug);
                }}
                aria-expanded={isOpen}
                aria-current={isSelectedParent ? 'true' : undefined}
                title={`${p.count} products`}
              >
                <span className={styles.caret} aria-hidden />
                <span className={styles.label}>{p.name}</span>
                <span className={styles.count} aria-hidden>
                  {p.count}
                </span>
              </button>

              {isOpen && !!p.children.length && (
                <ul className={styles.children}>
                  {p.children.map((c) => {
                    const isChildSelected = selected === c.slug;
                    return (
                      <li key={c.slug}>
                        <button
                          className={`${styles.child} ${isChildSelected ? styles.active : ''}`}
                          onClick={() => onSelect(c.slug)}
                          aria-current={isChildSelected ? 'true' : undefined}
                          title={`${c.count} products`}
                        >
                          <span className={styles.dot} aria-hidden />
                          <span className={styles.label}>{c.name}</span>
                          <span className={styles.count} aria-hidden>
                            {c.count}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {!parentsOnly.length && (
          <div className={styles.empty}>No categories with products yet.</div>
        )}
      </nav>

      <div className={styles.priceBox}>
        <div className={styles.priceHeader}>
          <h4>Filter by price</h4>
          <span className={styles.rangeText}>
            {currency(minVal)} — {currency(maxVal)}
          </span>
        </div>

        <div
          style={{
            opacity: sliderDisabled ? 0.55 : 1,
            pointerEvents: sliderDisabled ? 'none' : 'auto'
          }}
        >
          <RangeSlider
            aria-label="Price range"
            min={minLimit}
            max={maxLimit}
            step={1}
            value={{ min: minVal, max: maxVal }}
            onChange={({ min, max }) => setDraftPrice({ min, max })}
          />
        </div>

        <div className={styles.priceBtns}>
          <button
            className={styles.primary}
            onClick={() => onPriceChange(minVal, maxVal)}
            title="Apply price filter"
            disabled={sliderDisabled}
          >
            Apply
          </button>
          <button
            className={styles.ghost}
            onClick={() => {
              setDraftPrice({ min: null, max: null });
              onPriceChange(null, null);
            }}
            title="Clear price filter"
            disabled={sliderDisabled}
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
