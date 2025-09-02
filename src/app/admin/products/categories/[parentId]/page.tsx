'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import styles from './ChildPage.module.scss';

type Child = { id: string; name: string; slug: string; position: number; isActive: boolean; _count?: { products: number } };
type Parent = { id: string; name: string; slug: string; children: Child[] };

export default function CategoryChildrenPage() {
  // Safely coerce; in this route, parentId is guaranteed
  const { parentId } = (useParams() as { parentId: string });

  const [parent, setParent] = useState<Parent | null>(null);
  const [name, setName] = useState('');

  const load = async () => {
    const res = await fetch(`/api/admin/categories/${parentId}`, { cache: 'no-store' });
    if (res.ok) setParent(await res.json());
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [parentId]);

  const createChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await fetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, parentId }),
      headers: { 'Content-Type': 'application/json' },
    });
    setName('');
    load();
  };

  if (!parent) return <p className={styles.wrap}>Loading…</p>;

  return (
    <section className={styles.wrap}>
      <h2>{parent.name} — Children</h2>

      <form onSubmit={createChild} className={styles.inlineForm}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="New child name" />
        <button type="submit">Create</button>
      </form>

      <ul className={styles.list}>
        {parent.children.map(c => (
          <li key={c.id} className={styles.row}>
            <div>
              <strong>{c.name}</strong> <em>({c.slug})</em>
              <span className={styles.meta}>
                • position {c.position} • {c.isActive ? 'active' : 'inactive'} • {c._count?.products ?? 0} products
              </span>
            </div>
            <Link href={`/admin/products/categories/${parentId}/children/${c.id}`}>Open products →</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
