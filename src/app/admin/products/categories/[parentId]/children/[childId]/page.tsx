'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from './ProductsPage.module.scss';

type Product = { id: string; name: string };

export default function ProductsInChildPage() {
  // Safely coerce; in this route, childId is guaranteed
  const { childId } = (useParams() as { childId: string });

  const [products, setProducts] = useState<Product[]>([]);
  const [all, setAll] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [pendingAssign, setPendingAssign] = useState<string[]>([]);
  const [pendingUnassign, setPendingUnassign] = useState<string[]>([]);

  const load = async () => {
    const [inCatRes, allRes] = await Promise.all([
      fetch(`/api/admin/categories/${childId}/products`, { cache: 'no-store' }),
      fetch(`/api/admin/products?limit=200&fields=id,name`, { cache: 'no-store' })
    ]);
    setProducts(inCatRes.ok ? await inCatRes.json() : []);
    setAll(allRes.ok ? await allRes.json() : []);
    setPendingAssign([]); setPendingUnassign([]);
  };

  useEffect(() => { load();   }, [childId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter(p => p.name.toLowerCase().includes(q)) : all;
  }, [query, all]);

  const toggleAssign = (id: string, isInCategory: boolean) => {
    if (isInCategory) {
      setPendingUnassign(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
      setPendingAssign(prev => prev.filter(x=>x!==id));
    } else {
      setPendingAssign(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
      setPendingUnassign(prev => prev.filter(x=>x!==id));
    }
  };

  const commit = async () => {
    await fetch(`/api/admin/categories/${childId}/products`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignIds: pendingAssign, unassignIds: pendingUnassign })
    });
    load();
  };

  const currentIds = new Set(products.map(p => p.id));

  return (
    <section className={styles.wrap}>
      <h2>Products in this category</h2>

      <div className={styles.toolbar}>
        <input placeholder="Search products…" value={query} onChange={e=>setQuery(e.target.value)} />
        <button disabled={!pendingAssign.length && !pendingUnassign.length} onClick={commit}>
          Save changes
        </button>
      </div>

      <ul className={styles.grid}>
        {filtered.map(p => {
          const inCat = currentIds.has(p.id);
          const markedAdd = !inCat && pendingAssign.includes(p.id);
          const markedRemove = inCat && pendingUnassign.includes(p.id);
          return (
            <li key={p.id} className={`${styles.card} ${inCat ? styles.inCat : ''} ${markedAdd ? styles.toAdd : ''} ${markedRemove ? styles.toRemove : ''}`}>
              <div className={styles.title}>{p.name}</div>
              <button onClick={() => toggleAssign(p.id, inCat)}>
                {inCat ? (markedRemove ? 'Undo remove' : 'Remove') : (markedAdd ? 'Undo add' : 'Add')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
