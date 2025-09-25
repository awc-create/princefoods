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

  /** Absolute price bounds from the server (in GBP, whole pounds preferred) */
  priceBounds: { min: number; max: number } | null;

  /** Currently applied filter (controlled by parent) */
  currentPrice: { min: number | null; max: number | null };

  /** Report changes to parent */
  onPriceChange: (min: number | null, max: number | null) => void;
}) {
  const [cats, setCats] = useState<Parent[]>([]);
  const [openParent, setOpenParent] = useState<string | null>(null);

  // Fetch category tree
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/shop/categories', { cache: 'no-store' });
      const data = await res.json().catch(() => ({ categories: [] }));
      if (!cancelled) setCats(Array.isArray(data.categories) ? data.categories : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Expand the correct parent when selection changes
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

  // -------- Price slider plumbing --------
  const minLimit = useMemo(() => (priceBounds ? Math.floor(priceBounds.min) : 0), [priceBounds]);
  const maxLimit = useMemo(
    () => (priceBounds ? Math.max(Math.ceil(priceBounds.max), Math.floor(priceBounds.min)) : 0),
    [priceBounds]
  );

  // What the slider shows (default to the absolute limits if filter is empty)
  const minVal = currentPrice.min ?? minLimit;
  const maxVal = currentPrice.max ?? maxLimit;

  const currency = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);

  const parentsOnly = useMemo(() => cats, [cats]);

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

      {/* Price filter */}
      <div className={styles.priceBox}>
        <div className={styles.priceHeader}>
          <h4>Filter by price</h4>
          <span className={styles.rangeText}>
            {currency(minVal)} — {currency(maxVal)}
          </span>
        </div>

        <RangeSlider
          aria-label="Price range"
          min={minLimit}
          max={maxLimit}
          step={1}
          value={{ min: minVal, max: maxVal }}
          onChange={({ min, max }) => onPriceChange(min, max)}
        />

        <div className={styles.priceBtns}>
          <button
            className={styles.primary}
            onClick={() => onPriceChange(minVal, maxVal)}
            title="Apply price filter"
          >
            Apply
          </button>
          <button
            className={styles.ghost}
            onClick={() => onPriceChange(null, null)}
            title="Clear price filter"
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
