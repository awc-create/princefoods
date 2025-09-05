'use client';

import { safeImageUrl } from '@/utils/safeImageUrl';
import { Download, Eye, EyeOff, Megaphone, MoreVertical, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Products.module.scss';

interface Row {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  inventory: string | null;
  collection: string | null;
  productImageUrl: string | null;
  visible: boolean;
  createdAt: string;
}

function childCategory(full?: string | null) {
  if (!full) return '—';
  const parts = full
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '—';
}

export default function ProductsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // bulk select
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selected[r.id]);
  const someSelected = rows.some((r) => selected[r.id]);

  // "Select all matching results" (across pages)
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [matchingCount, setMatchingCount] = useState<number | null>(null);

  const menuRef = useRef<HTMLDivElement | null>(null);

  // Load list
  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/products?search=${encodeURIComponent(q)}&page=${page}`);
    const data = await res.json();
    setRows(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [q, page]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (ignore) return;
      await load();
      // reset cross-page selection when query/page changes
      setAllMatchingSelected(false);
      setMatchingCount(null);
      setSelected({});
    })();
    return () => {
      ignore = true;
    };
  }, [load]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const toggleSelect = useCallback((id: string, on: boolean) => {
    setSelected((prev) => ({ ...prev, [id]: on }));
    setAllMatchingSelected(false);
  }, []);

  const toggleSelectPage = useCallback(
    (on: boolean) => {
      const upd: Record<string, boolean> = { ...selected };
      for (const r of rows) upd[r.id] = on;
      setSelected(upd);
      setAllMatchingSelected(false);
    },
    [rows, selected]
  );

  const clearSelection = useCallback(() => {
    setSelected({});
    setAllMatchingSelected(false);
    setMatchingCount(null);
  }, []);

  const idsSelected = useCallback((): string[] => {
    return rows.filter((r) => selected[r.id]).map((r) => r.id);
  }, [rows, selected]);

  const ensureMatchingCount = useCallback(async () => {
    if (matchingCount != null) return matchingCount;
    const res = await fetch(`/api/admin/products/count?search=${encodeURIComponent(q)}`);
    const data = await res.json();
    setMatchingCount(data.count ?? 0);
    return data.count ?? 0;
  }, [matchingCount, q]);

  const selectAllMatching = useCallback(async () => {
    const count = await ensureMatchingCount();
    if (count > 0) setAllMatchingSelected(true);
  }, [ensureMatchingCount]);

  const toggleVisible = useCallback(async (id: string, next: boolean) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: next })
    });
    if (res.ok) {
      setRows((rs) => rs.map((r) => (r.id === id ? { ...r, visible: next } : r)));
    }
  }, []);

  const duplicate = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        setPage(1);
        await load();
      }
    },
    [load]
  );

  const remove = useCallback(async (id: string) => {
    const ok = confirm('Delete this product? This cannot be undone.');
    if (!ok) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (res.ok) setRows((rs) => rs.filter((r) => r.id !== id));
  }, []);

  // Bulk actions
  const bulk = useCallback(
    async (action: 'hide' | 'show' | 'delete') => {
      if (allMatchingSelected) {
        if (action === 'delete') {
          const ok = confirm(`Delete ALL products that match your search? This cannot be undone.`);
          if (!ok) return;
        }
        const res = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, allMatching: true, search: q })
        });
        if (res.ok) {
          clearSelection();
          await load();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.message ?? 'Bulk action failed');
        }
        return;
      }

      const ids = idsSelected();
      if (ids.length === 0) return;

      if (action === 'delete') {
        const ok = confirm(`Delete ${ids.length} product(s)? This cannot be undone.`);
        if (!ok) return;
      }

      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids })
      });
      if (res.ok) {
        clearSelection();
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message ?? 'Bulk action failed');
      }
    },
    [allMatchingSelected, q, clearSelection, load, idsSelected]
  );

  const exportSelected = useCallback(() => {
    const ids = idsSelected();
    const url =
      ids.length > 0
        ? `/api/admin/products/export?ids=${encodeURIComponent(ids.join(','))}`
        : `/api/admin/products/export`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [idsSelected]);

  const header = useMemo(() => {
    return (
      <div className={styles.toolbar}>
        <input
          placeholder="Search name, SKU, brand, collection…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />
        <div className={styles.spacer} />
        <Link href="/admin/products/import" className={styles.secondaryBtn}>
          <Upload size={16} style={{ marginRight: 6 }} /> Import
        </Link>
        <button onClick={exportSelected} className={styles.secondaryBtn}>
          <Download size={16} style={{ marginRight: 6 }} /> Export
        </button>
        <Link href="/admin/products/create" className={styles.primaryBtn}>
          + New product
        </Link>
      </div>
    );
  }, [q, exportSelected]);

  const pageSelectionBanner = useMemo(() => {
    if (!allOnPageSelected || allMatchingSelected) return null;
    return (
      <div className={styles.selectAllBanner}>
        <span>
          All {rows.length} items on this page are selected.{' '}
          <button onClick={selectAllMatching} className={styles.linkBtn}>
            {matchingCount == null
              ? 'Select all matching results'
              : `Select all ${matchingCount} matching results`}
          </button>
        </span>
        <button onClick={clearSelection} className={styles.linkBtn}>
          Clear selection
        </button>
      </div>
    );
  }, [
    allOnPageSelected,
    allMatchingSelected,
    rows.length,
    matchingCount,
    selectAllMatching,
    clearSelection
  ]);

  const bulkBar = useMemo(() => {
    if (!someSelected && !allMatchingSelected) return null;
    const count = allMatchingSelected
      ? (matchingCount ?? '…')
      : Object.values(selected).filter(Boolean).length;

    return (
      <div className={styles.bulkBar}>
        <span>{count} selected</span>
        <div className={styles.bulkActions}>
          <button onClick={() => bulk('hide')}>
            <EyeOff size={16} /> Hide
          </button>
          <button onClick={() => bulk('show')}>
            <Eye size={16} /> Show
          </button>
          <button className={styles.danger} onClick={() => bulk('delete')}>
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={exportSelected}>
            <Download size={16} /> Export
          </button>
        </div>
      </div>
    );
  }, [someSelected, allMatchingSelected, matchingCount, selected, bulk, exportSelected]);

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Products</h1>

      {bulkBar}
      {pageSelectionBanner}
      {header}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colCheck}>
                <input
                  type="checkbox"
                  // show checked if either all on this page OR all-matching are selected
                  checked={allOnPageSelected || allMatchingSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      // select this page; banner will appear offering “select all matching”
                      toggleSelectPage(true);
                    } else {
                      // clear all selection modes
                      clearSelection();
                    }
                  }}
                  aria-label="Select all on page"
                />
              </th>
              <th className={styles.colPic}>Pic</th>
              <th>Name</th>
              <th>SKU</th>
              <th>Price</th>
              <th>Inventory</th>
              <th>Collection</th>
              <th className={styles.colActions}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className={styles.muted}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.muted}>
                  No products found
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const img = safeImageUrl(r.productImageUrl);
                return (
                  <tr key={r.id} className={styles.row}>
                    <td className={styles.checkCell}>
                      <input
                        type="checkbox"
                        checked={!!selected[r.id] || allMatchingSelected}
                        onChange={(e) => toggleSelect(r.id, e.target.checked)}
                        aria-label={`Select ${r.name}`}
                      />
                    </td>
                    <td className={styles.picCell}>
                      <div className={styles.pic}>
                        {img ? (
                          <Image
                            src={img}
                            alt={r.name}
                            fill
                            sizes="48px"
                            style={{ objectFit: 'cover' }}
                          />
                        ) : (
                          <div className={styles.placeholder}>📦</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.nameCell}>
                        <Link href={`/admin/products/${r.id}`} className={styles.nameLink}>
                          {r.name}
                        </Link>
                        {!r.visible && <span className={styles.badge}>Hidden</span>}
                      </div>
                    </td>
                    <td>{r.sku ?? '—'}</td>
                    <td>{r.price != null ? `£${r.price.toFixed(2)}` : '—'}</td>
                    <td>{r.inventory ?? '—'}</td>
                    <td>{childCategory(r.collection)}</td>

                    <td className={styles.actionsCell}>
                      <div className={styles.hoverbar}>
                        <button
                          className={styles.iconBtn}
                          title="Boost (promote)"
                          onClick={() => alert('We’ll add Boost flows soon ✨')}
                        >
                          <Megaphone size={16} />
                        </button>
                        {r.visible ? (
                          <button
                            className={styles.iconBtn}
                            title="Hide from store"
                            onClick={() => toggleVisible(r.id, false)}
                          >
                            <EyeOff size={16} />
                          </button>
                        ) : (
                          <button
                            className={styles.iconBtn}
                            title="Show in store"
                            onClick={() => toggleVisible(r.id, true)}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <div className={styles.menuWrap} ref={menuRef}>
                          <button
                            className={styles.iconBtn}
                            title="More"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenu((id) => (id === r.id ? null : r.id));
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                          {openMenu === r.id && (
                            <div className={styles.menu}>
                              <Link href={`/admin/products/${r.id}`}>Edit</Link>
                              <button onClick={() => duplicate(r.id)}>Duplicate</button>
                              <button className={styles.danger} onClick={() => remove(r.id)}>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pager}>
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
