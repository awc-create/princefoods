'use client';

import MediaField from '@/components/media/MediaField';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import styles from './CategoryPage.module.scss';

interface Category {
  id: string;
  name: string;
  slug: string;
  position: number;
  isActive: boolean;
  imageUrl?: string | null;
  _count?: { children: number };
}

interface BackfillResponse {
  ok?: boolean;
  error?: string;
  message?: string;
  parents?: number;
  children?: number;
  updatedProducts?: number;
  scannedProducts?: number;
  parentsTouched?: number;
  childrenTouched?: number;
  productsUpdated?: number;
  productsScanned?: number;
}

export default function Page() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(false);

  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, Partial<Category>>>({});

  const load = async () => {
    try {
      const res = await fetch('/api/admin/categories', { cache: 'no-store' });
      const data: unknown = await res.json().catch(() => []);
      setItems(Array.isArray(data) ? (data as Category[]) : []);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!cancel) await load();
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const createParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setBusy(true);
      await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      setName('');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const backfill = async () => {
    try {
      setBusy(true);
      setMsg(null);
      const qs = dryRun ? '?dry=1' : '';
      const res = await fetch(`/api/admin/categories/backfill${qs}`, { method: 'POST' });
      const data: unknown = await res.json().catch(() => ({}));

      const b = (
        typeof data === 'object' && data !== null ? (data as BackfillResponse) : {}
      ) as BackfillResponse;

      if (!res.ok || b.ok === false) {
        const detail = b.error ?? b.message ?? `HTTP ${res.status}`;
        throw new Error(detail);
      }

      const num = (v: unknown) => (typeof v === 'number' ? v : 0);

      const parents = num(b.parents ?? b.parentsTouched);
      const children = num(b.children ?? b.childrenTouched);
      const updated = num(b.updatedProducts ?? b.productsUpdated);
      const scanned = num(b.scannedProducts ?? b.productsScanned);

      setMsg(
        `Backfill ${dryRun ? '(dry run) ' : ''}complete: scanned ${scanned}, parents ${parents}, children ${children}, products linked ${updated}.`
      );
      await load();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setMsg(`Backfill failed: ${message}`);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (c: Category) => {
    setEditing((e) => ({ ...e, [c.id]: true }));
    setDrafts((d) => ({
      ...d,
      [c.id]: { name: c.name, isActive: c.isActive, imageUrl: c.imageUrl ?? '' }
    }));
  };

  const cancelEdit = (id: string) => {
    setEditing((e) => ({ ...e, [id]: false }));
    setDrafts((d) => {
      const { [id]: _removed, ...rest } = d;
      return rest;
    });
  };

  const patch = async (id: string) => {
    const draft = drafts[id] || {};
    setBusy(true);
    try {
      await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          isActive: draft.isActive,
          imageUrl: (draft.imageUrl ?? '').toString() || null
        })
      });
      await load();
      cancelEdit(id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.wrap}>
      <h2>Parent Categories</h2>

      <div className={styles.headerRow}>
        <form onSubmit={createParent}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New parent name"
          />
          <button type="submit" disabled={busy}>
            Create
          </button>
        </form>

        <div className={styles.right}>
          <label>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              disabled={busy}
            />
            Dry run
          </label>
          <button onClick={backfill} disabled={busy}>
            {busy ? 'Backfilling…' : 'Backfill from products'}
          </button>
        </div>
      </div>

      {msg && (
        <p
          className={styles.inlineMsg}
          style={{ color: msg.startsWith('Backfill failed') ? '#b00' : '#0a7' }}
        >
          {msg}
        </p>
      )}

      {items.length ? (
        <ul className={styles.grid}>
          {items.map((c) => {
            const isEditing = !!editing[c.id];
            const d = drafts[c.id] || {};
            const currentImage = (d.imageUrl as string) ?? c.imageUrl ?? '';
            const mediaValue = currentImage || null;
            const categoryFolder = c.slug || c.name;

            return (
              <li key={c.id} className={styles.card}>
                <Link
                  href={`/admin/products/categories/${c.id}`}
                  className={styles.thumb}
                  aria-label={`Open ${c.name}`}
                  title="Open category"
                >
                  {currentImage ? (
                    <img src={currentImage} alt={c.name} />
                  ) : (
                    <div className={styles.noImg}>No image</div>
                  )}
                  <span className={styles.thumbOverlay}>Open</span>
                </Link>

                <div className={styles.body}>
                  <div className={styles.title}>
                    <span>{c.name}</span>
                    <Link href={`/admin/products/categories/${c.id}`}>Open →</Link>
                  </div>

                  {isEditing ? (
                    <div className={styles.editPanel}>
                      <div className={styles.field}>
                        <label htmlFor={`name-${c.id}`}>Name</label>
                        <input
                          id={`name-${c.id}`}
                          className={styles.input}
                          type="text"
                          value={(d.name as string) ?? c.name}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], name: e.target.value }
                            }))
                          }
                        />
                      </div>

                      <div className={styles.field}>
                        <label>Category Media</label>
                        <MediaField
                          label="Category Image"
                          modalTitle={`Media Library — ${c.name}`}
                          pathSegments={['categories', categoryFolder]}
                          itemName="thumbnail"
                          value={mediaValue}
                          onChange={(url) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], imageUrl: url ?? '' }
                            }))
                          }
                          accept="image/*"
                        />
                      </div>

                      <div className={styles.field}>
                        <label htmlFor={`imgurl-${c.id}`}>Image URL</label>
                        <input
                          id={`imgurl-${c.id}`}
                          className={styles.input}
                          type="text"
                          placeholder="https://…"
                          value={(d.imageUrl as string) ?? c.imageUrl ?? ''}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], imageUrl: e.target.value }
                            }))
                          }
                        />
                      </div>

                      <div className={styles.fieldInline}>
                        <label className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={
                              typeof d.isActive === 'boolean' ? (d.isActive as boolean) : c.isActive
                            }
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], isActive: e.target.checked }
                              }))
                            }
                          />
                          Active
                        </label>
                      </div>

                      <div className={styles.actions}>
                        <button
                          type="button"
                          onClick={() => void patch(c.id)}
                          disabled={busy}
                          className={styles.primaryBtn}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEdit(c.id)}
                          disabled={busy}
                          className={styles.ghostBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.actionsTop}>
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className={styles.secondaryBtn}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.notice}>
          No categories yet. Click <em>Backfill from products</em> to generate from{' '}
          <code>Product.collection</code>, or create one above.
        </p>
      )}
    </section>
  );
}
