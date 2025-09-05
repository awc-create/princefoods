// src/app/admin/products/[id]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Edit.module.scss';

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  inventory: string | null;
  collection: string | null;
  productImageUrl: string | null;
  description: string | null;
  visible: boolean;
}

export default function ProductEditPage() {
  // Don't destructure directly; handle possible null/loose typing
  const params = useParams() as { id?: string } | null;
  const id = params?.id; // string | undefined

  const router = useRouter();
  const [p, setP] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    if (!id) return; // wait until id exists

    (async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/products/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (ignore) return;
      setP(data.product as Product);
      setLoading(false);
    })();

    return () => {
      ignore = true;
    };
  }, [id]);

  if (!id) return <div className={styles.wrap}>Loading…</div>;
  if (loading) return <div className={styles.wrap}>Loading…</div>;
  if (!p) return <div className={styles.wrap}>Not found.</div>;

  async function save() {
    if (!id) return;
    setSaving(true);
    const res = await fetch(`/api/admin/products/${id}/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    setSaving(false);
    if (res.ok) router.push('/admin/products');
  }

  return (
    <div className={styles.wrap}>
      <h1>Edit: {p.name}</h1>
      <div className={styles.form}>
        <label>
          Name
          <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </label>

        <label>
          SKU
          <input
            value={p.sku ?? ''}
            onChange={(e) => setP({ ...p, sku: e.target.value || null })}
          />
        </label>

        <label>
          Price
          <input
            type="number"
            step="0.01"
            value={p.price ?? ''}
            onChange={(e) => setP({ ...p, price: e.target.value ? Number(e.target.value) : null })}
          />
        </label>

        <label>
          Inventory
          <input
            value={p.inventory ?? ''}
            onChange={(e) => setP({ ...p, inventory: e.target.value || null })}
          />
        </label>

        <label>
          Collection
          <input
            value={p.collection ?? ''}
            onChange={(e) => setP({ ...p, collection: e.target.value || null })}
          />
        </label>

        <label>
          Image URL
          <input
            value={p.productImageUrl ?? ''}
            onChange={(e) => setP({ ...p, productImageUrl: e.target.value || null })}
          />
        </label>

        <label>
          Description
          <textarea
            value={p.description ?? ''}
            onChange={(e) => setP({ ...p, description: e.target.value || null })}
          />
        </label>

        <label className={styles.inline}>
          <input
            type="checkbox"
            checked={p.visible}
            onChange={(e) => setP({ ...p, visible: e.target.checked })}
          />
          Visible
        </label>
      </div>

      <div className={styles.actions}>
        <button onClick={() => router.back()} className={styles.secondary}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} className={styles.primary}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
