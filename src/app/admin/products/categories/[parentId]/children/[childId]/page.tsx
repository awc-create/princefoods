'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ProductsPage.module.scss';

interface Product {
  id: string;
  name: string;
}

export default function ProductsInChildPage() {
  const { childId } = useParams() as { childId: string };

  const [inCatProducts, setInCatProducts] = useState<Product[]>([]);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [pendingAssign, setPendingAssign] = useState<string[]>([]);
  const [pendingUnassign, setPendingUnassign] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadInCat = useCallback(async () => {
    const res = await fetch(`/api/admin/categories/${childId}/products`, { cache: 'no-store' });
    setInCatProducts(res.ok ? await res.json() : []);
    setPendingAssign([]);
    setPendingUnassign([]);
  }, [childId]);

  useEffect(() => {
    loadInCat();
  }, [loadInCat]);

  // Debounced search — only hits the API after 300ms pause
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/products?q=${encodeURIComponent(q)}&limit=30`);
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : (data.products ?? []));
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query]);

  const toggleAssign = (id: string, isInCategory: boolean) => {
    if (isInCategory) {
      setPendingUnassign((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      setPendingAssign((prev) => prev.filter((x) => x !== id));
    } else {
      setPendingAssign((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      );
      setPendingUnassign((prev) => prev.filter((x) => x !== id));
    }
  };

  const commit = async () => {
    await fetch(`/api/admin/categories/${childId}/products`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignIds: pendingAssign, unassignIds: pendingUnassign })
    });
    loadInCat();
    setQuery('');
    setSearchResults([]);
  };

  const currentIds = new Set(inCatProducts.map((p) => p.id));
  const displayList = query.trim() ? searchResults : inCatProducts;

  return (
    <section className={styles.wrap}>
      <h2>Products in this category</h2>

      <div className={styles.toolbar}>
        <input
          placeholder="Search to add products… (type at least 2 chars)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={!pendingAssign.length && !pendingUnassign.length} onClick={commit}>
          Save changes ({pendingAssign.length} add, {pendingUnassign.length} remove)
        </button>
      </div>

      {!query.trim() && (
        <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px' }}>
          Showing {inCatProducts.length} products currently in this category. Search above to find
          and add more.
        </p>
      )}
      {searching && <p style={{ fontSize: 13, color: '#6b7280' }}>Searching…</p>}

      <ul className={styles.grid}>
        {displayList.map((p) => {
          const inCat = currentIds.has(p.id);
          const markedAdd = !inCat && pendingAssign.includes(p.id);
          const markedRemove = inCat && pendingUnassign.includes(p.id);
          return (
            <li
              key={p.id}
              className={`${styles.card} ${inCat ? styles.inCat : ''} ${markedAdd ? styles.toAdd : ''} ${
                markedRemove ? styles.toRemove : ''
              }`}
            >
              <div className={styles.title}>{p.name}</div>
              <button onClick={() => toggleAssign(p.id, inCat)}>
                {inCat ? (markedRemove ? 'Undo remove' : 'Remove') : markedAdd ? 'Undo add' : 'Add'}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
