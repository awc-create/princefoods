// src/app/admin/products/categories/page.tsx
'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
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
  // alt keys that may be returned
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

  // hidden <input type="file"> for each card (only used by "Upload file")
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

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

      // Normalize response
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

  // upload helper (button + drag & drop + paste in edit panel)
  const uploadImageFile = async (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/categories/${id}/image`, { method: 'POST', body: form });
      const data: unknown = await res.json().catch(() => ({}));
      const ok =
        typeof data === 'object' && data !== null && 'url' in (data as Record<string, unknown>);
      if (!res.ok || !ok) {
        const errMsg =
          (typeof data === 'object' && data && 'error' in data
            ? String((data as { error?: unknown }).error)
            : null) ?? `Upload failed (${res.status})`;
        throw new Error(errMsg);
      }
      const url = String((data as { url: unknown }).url);
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, imageUrl: url } : c)));
      setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], imageUrl: url } }));
    } finally {
      setBusy(false);
    }
  };

  const openPicker = (id: string) => fileInputs.current[id]?.click();

  const onPick = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await uploadImageFile(id, file);
  };

  const onDrop = async (id: string, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadImageFile(id, file);
  };

  const onPaste = async (id: string, e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = e.clipboardData?.files?.[0];
    if (file) await uploadImageFile(id, file);
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

            return (
              <li key={c.id} className={styles.card}>
                {/* hidden input for file picker (used by "Upload file" only) */}
                <input
                  ref={(el) => {
                    fileInputs.current[c.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className={styles.fileHidden}
                  onChange={(e) => onPick(c.id, e)}
                />

                {/* Thumbnail now NAVIGATES (no upload on click) */}
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
                    <div
                      className={styles.editPanel}
                      onPaste={(e) => onPaste(c.id, e)}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDrop={(e) => onDrop(c.id, e)}
                      title="Drag & drop or paste image here"
                    >
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
                        <label htmlFor={`imgurl-${c.id}`}>Image URL</label>
                        <div className={styles.hstack}>
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
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => openPicker(c.id)}
                            disabled={busy}
                          >
                            Upload file
                          </button>
                        </div>
                      </div>

                      {currentImage && (
                        <div className={styles.preview}>
                          {}
                          <img src={currentImage} alt="" />
                          <button
                            type="button"
                            className={styles.removePreview}
                            onClick={() =>
                              setDrafts((prev) => ({
                                ...prev,
                                [c.id]: { ...prev[c.id], imageUrl: '' }
                              }))
                            }
                            aria-label="Remove image"
                          >
                            ×
                          </button>
                        </div>
                      )}

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
                          onClick={() => patch(c.id)}
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
