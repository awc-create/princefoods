'use client';

import { safeImageUrl } from '@/utils/safeImageUrl';
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  Filter,
  MoreVertical,
  Trash2,
  Upload,
  X
} from 'lucide-react';
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

interface CollectionItem {
  value: string;
  count: number;
}

function parseCollection(full?: string | null) {
  const raw = (full ?? '').trim();
  if (!raw) return { parent: 'Uncategorized', child: 'Uncategorized', full: '' };

  const parts = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  const parent = parts[0] ?? 'Uncategorized';
  const child = parts.length > 1 ? parts[parts.length - 1] : parent;
  return { parent, child, full: raw };
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

  // collections filter
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const filterRef = useRef<HTMLDivElement | null>(null);

  const collectionsParam = useMemo(() => {
    if (!selectedCollections.length) return '';
    return selectedCollections.map((v) => encodeURIComponent(v)).join(',');
  }, [selectedCollections]);

  const load = useCallback(async () => {
    setLoading(true);
    const url = `/api/admin/products?search=${encodeURIComponent(q)}&page=${page}${
      collectionsParam ? `&collections=${collectionsParam}` : ''
    }`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    setRows(data.items ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [q, page, collectionsParam]);

  const loadCollections = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/products/collections?search=${encodeURIComponent(q)}`, {
        cache: 'no-store'
      });
      const data = (await res.json().catch(() => ({}))) as { items?: CollectionItem[] };
      setCollections(Array.isArray(data.items) ? data.items : []);
    } catch {
      setCollections([]);
    }
  }, [q]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (ignore) return;
      await Promise.all([load(), loadCollections()]);

      // reset cross-page selection when query/page/filters changes
      setAllMatchingSelected(false);
      setMatchingCount(null);
      setSelected({});
    })();
    return () => {
      ignore = true;
    };
  }, [load, loadCollections]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      // Fix 3: check if click is inside ANY menu wrap, not just the last one via shared ref
      const target = e.target as Node;
      const menuWrap = (target as Element)?.closest?.('[data-menu-id]');
      if (!menuWrap) setOpenMenu(null);
      if (filterRef.current && !filterRef.current.contains(target)) setCollectionOpen(false);
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

    const url = `/api/admin/products/count?search=${encodeURIComponent(q)}${
      collectionsParam ? `&collections=${collectionsParam}` : ''
    }`;
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    const c = typeof data.count === 'number' ? data.count : 0;

    setMatchingCount(c);
    return c;
  }, [matchingCount, q, collectionsParam]);

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

  const bulk = useCallback(
    async (action: 'hide' | 'show' | 'delete') => {
      if (allMatchingSelected) {
        if (action === 'delete') {
          const ok = confirm(
            `Delete ALL products that match your current filters? This cannot be undone.`
          );
          if (!ok) return;
        }

        const res = await fetch('/api/admin/products/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            allMatching: true,
            search: q,
            collections: selectedCollections
          })
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
      if (!ids.length) return;

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
    [allMatchingSelected, q, selectedCollections, clearSelection, load, idsSelected]
  );

  const exportSelected = useCallback(() => {
    const ids = idsSelected();

    const url =
      ids.length > 0
        ? `/api/admin/products/export?ids=${encodeURIComponent(ids.join(','))}`
        : `/api/admin/products/export?search=${encodeURIComponent(q)}${
            selectedCollections.length
              ? `&collections=${encodeURIComponent(selectedCollections.join(','))}`
              : ''
          }`;

    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [idsSelected, q, selectedCollections]);

  // Group collections by parent, show child label only
  const groupedCollections = useMemo(() => {
    const groups = new Map<string, { value: string; child: string; count: number }[]>();

    const qq = collectionQuery.trim().toLowerCase();

    const filtered = collections.filter((c) => {
      const { parent, child } = parseCollection(c.value);
      const text = `${parent} ${child} ${c.value}`.toLowerCase();
      return !qq || text.includes(qq);
    });

    for (const c of filtered) {
      const { parent, child } = parseCollection(c.value);
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent)!.push({ value: c.value, child, count: c.count });
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([parent, items]) => ({
        parent,
        items: items.sort((x, y) => y.count - x.count || x.child.localeCompare(y.child))
      }));
  }, [collections, collectionQuery]);

  const toggleCollection = useCallback((full: string) => {
    setPage(1);
    setSelectedCollections((prev) =>
      prev.includes(full) ? prev.filter((x) => x !== full) : [...prev, full]
    );
  }, []);

  const clearCollections = useCallback(() => {
    setPage(1);
    setSelectedCollections([]);
    setCollectionQuery('');
  }, []);

  const selectedCollectionLabels = useMemo(() => {
    return selectedCollections.map((full) => {
      const { parent, child } = parseCollection(full);
      return { full, parent, child };
    });
  }, [selectedCollections]);

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

      <div className={styles.toolbar}>
        <input
          placeholder="Search name, SKU, brand, collection…"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
        />

        <div className={styles.filterWrap} ref={filterRef}>
          <button
            type="button"
            className={styles.filterBtn}
            onClick={(e) => {
              e.stopPropagation();
              setCollectionOpen((v) => !v);
            }}
            aria-expanded={collectionOpen}
          >
            <Filter size={16} />
            Collections
            {selectedCollections.length ? (
              <span className={styles.filterCount}>{selectedCollections.length}</span>
            ) : null}
            <ChevronDown size={16} />
          </button>

          {collectionOpen && (
            <div className={styles.filterMenu} onClick={(e) => e.stopPropagation()}>
              <div className={styles.filterTop}>
                <input
                  placeholder="Filter collections…"
                  value={collectionQuery}
                  onChange={(e) => setCollectionQuery(e.target.value)}
                />
                <button
                  type="button"
                  className={styles.clearMini}
                  onClick={clearCollections}
                  disabled={!selectedCollections.length && !collectionQuery}
                >
                  Clear
                </button>
              </div>

              <div className={styles.filterBody}>
                {groupedCollections.length === 0 ? (
                  <div className={styles.filterEmpty}>No collections found</div>
                ) : (
                  groupedCollections.map((g) => (
                    <div key={g.parent} className={styles.group}>
                      <div className={styles.groupTitle}>{g.parent}</div>
                      <div className={styles.groupItems}>
                        {g.items.map((it) => {
                          const on = selectedCollections.includes(it.value);
                          return (
                            <button
                              key={it.value}
                              type="button"
                              className={`${styles.item} ${on ? styles.itemOn : ''}`}
                              onClick={() => toggleCollection(it.value)}
                              title={it.value}
                            >
                              <span className={styles.itemLeft}>
                                <span className={styles.checkbox}>
                                  {on ? <Check size={14} /> : null}
                                </span>
                                <span className={styles.itemLabel}>{it.child}</span>
                              </span>
                              <span className={styles.itemCount}>{it.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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

      {selectedCollectionLabels.length ? (
        <div className={styles.selectedChips}>
          {selectedCollectionLabels.map((c) => (
            <button
              key={c.full}
              type="button"
              className={styles.chip}
              onClick={() => toggleCollection(c.full)}
              title={c.full}
            >
              <span className={styles.chipParent}>{c.parent}</span>
              <span className={styles.chipSep}>→</span>
              <span className={styles.chipChild}>{c.child}</span>
              <X size={14} className={styles.chipX} />
            </button>
          ))}
          <button type="button" className={styles.clearAll} onClick={clearCollections}>
            Clear collections
          </button>
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colCheck}>
                <input
                  type="checkbox"
                  checked={allOnPageSelected || allMatchingSelected}
                  onChange={(e) => {
                    if (e.target.checked) toggleSelectPage(true);
                    else clearSelection();
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
                const { parent, child } = parseCollection(r.collection);

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

                    <td>
                      {r.collection ? (
                        <span className={styles.collectionBadge} title={r.collection}>
                          <span className={styles.collectionParent}>{parent}</span>
                          <span className={styles.collectionDot}>•</span>
                          <span className={styles.collectionChild}>{child}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className={styles.actionsCell}>
                      <div className={styles.hoverbar}>
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

                        <div className={styles.menuWrap} data-menu-id={r.id}>
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
