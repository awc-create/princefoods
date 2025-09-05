'use client';

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
  onPriceFilterChange
}: {
  selected: string | null;
  onSelect: (slug: string | null) => void;
  onPriceFilterChange: (min: number | null, max: number | null) => void;
}) {
  const [cats, setCats] = useState<Parent[]>([]);
  const [min, setMin] = useState<string>('');
  const [max, setMax] = useState<string>('');
  const [openParent, setOpenParent] = useState<string | null>(null);

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

  // When selection or categories change, ensure the correct parent is expanded
  useEffect(() => {
    if (!selected) {
      setOpenParent(null);
      return;
    }
    // If a parent is selected, open it
    const asParent = cats.find((p) => p.slug === selected);
    if (asParent) {
      setOpenParent(asParent.slug);
      return;
    }
    // If a child is selected, open its parent
    const parentOfChild = cats.find((p) => p.children.some((c) => c.slug === selected));
    if (parentOfChild) setOpenParent(parentOfChild.slug);
  }, [selected, cats]);

  const applyPrice = () => {
    const minN = min.trim() === '' ? null : Number(min);
    const maxN = max.trim() === '' ? null : Number(max);
    onPriceFilterChange(
      minN != null && Number.isFinite(minN) ? minN : null,
      maxN != null && Number.isFinite(maxN) ? maxN : null
    );
  };

  const clearPrice = () => {
    setMin('');
    setMax('');
    onPriceFilterChange(null, null);
  };

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
                  // select the parent category and expand it; close others
                  onSelect(p.slug);
                  setOpenParent((prev) => (prev === p.slug ? p.slug : p.slug));
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
        <h4>Filter by Price</h4>
        <div className={styles.row}>
          <input
            inputMode="decimal"
            placeholder="Min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            aria-label="Minimum price"
          />
          <input
            inputMode="decimal"
            placeholder="Max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            aria-label="Maximum price"
          />
        </div>
        <div className={styles.rowBtns}>
          <button className={styles.primary} onClick={applyPrice}>
            Apply
          </button>
          <button className={styles.ghost} onClick={clearPrice}>
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
