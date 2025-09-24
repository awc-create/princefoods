'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

  // local slider state (controlled mirror of currentPrice)
  const [minV, setMinV] = useState<number | null>(currentPrice.min);
  const [maxV, setMaxV] = useState<number | null>(currentPrice.max);

  // keep locals in sync when parent updates (e.g., after bounds load)
  useEffect(() => {
    setMinV(currentPrice.min);
    setMaxV(currentPrice.max);
  }, [currentPrice.min, currentPrice.max]);

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

  // clamp helpers
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

  // apply with debounce to avoid spamming fetch
  const applyTimer = useRef<number | null>(null);
  const scheduleApply = (nextMin: number | null, nextMax: number | null) => {
    if (applyTimer.current) window.clearTimeout(applyTimer.current);
    applyTimer.current = window.setTimeout(() => {
      onPriceChange(nextMin, nextMax);
    }, 200);
  };

  const bounds = priceBounds ?? { min: 0, max: 0 };
  const realMin = minV ?? bounds.min;
  const realMax = maxV ?? bounds.max;

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

      {/* Price range */}
      <div className={styles.priceBox}>
        <h4>Filter by Price</h4>

        {/* Double range inputs (keeps within the card and accessible) */}
        <div className={styles.sliderWrap}>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={realMin}
            onChange={(e) => {
              const v = clamp(Number(e.target.value), bounds.min, realMax);
              setMinV(v);
              scheduleApply(v, realMax);
            }}
            aria-label="Minimum price"
          />
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={1}
            value={realMax}
            onChange={(e) => {
              const v = clamp(Number(e.target.value), realMin, bounds.max);
              setMaxV(v);
              scheduleApply(realMin, v);
            }}
            aria-label="Maximum price"
          />
          <div className={styles.sliderTrack} aria-hidden />
        </div>

        <div className={styles.row}>
          <input
            inputMode="decimal"
            placeholder="Min"
            value={String(realMin)}
            onChange={(e) => {
              const v = clamp(Number(e.target.value || bounds.min), bounds.min, realMax);
              setMinV(v);
            }}
            onBlur={() => scheduleApply(realMin, realMax)}
            aria-label="Minimum price"
          />
          <input
            inputMode="decimal"
            placeholder="Max"
            value={String(realMax)}
            onChange={(e) => {
              const v = clamp(Number(e.target.value || bounds.max), realMin, bounds.max);
              setMaxV(v);
            }}
            onBlur={() => scheduleApply(realMin, realMax)}
            aria-label="Maximum price"
          />
        </div>

        <div className={styles.rowBtns}>
          <button className={styles.primary} onClick={() => onPriceChange(realMin, realMax)}>
            Apply
          </button>
          <button
            className={styles.ghost}
            onClick={() => {
              if (priceBounds) {
                setMinV(priceBounds.min);
                setMaxV(priceBounds.max);
                onPriceChange(priceBounds.min, priceBounds.max);
              } else {
                setMinV(null);
                setMaxV(null);
                onPriceChange(null, null);
              }
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </aside>
  );
}
