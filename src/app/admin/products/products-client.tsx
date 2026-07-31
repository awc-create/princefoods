'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';
import EmptyState from '@/components/admin/ui/EmptyState';
import useDebouncedValue from '@/components/admin/ui/useDebouncedValue';
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
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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

export default function ProductsClient() {
  const router = useRouter();
  const pathname = usePathname() ?? '/admin/products';
  const spRaw = useSearchParams();
  const sp = useMemo(() => new URLSearchParams(spRaw?.toString() ?? ''), [spRaw]);
  const { toast, confirm } = useAdminUi();

  // URL-derived state (survives navigation/back)
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1);
  const selectedCollections = useMemo(
    () => (sp.get('collections') ?? '').split(',').map(decodeURIComponent).filter(Boolean),
    [sp]
  );

  const setParams = useCallback(
    (updates: Record<string, string>, resetPage = true) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      if (resetPage) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname]
  );

  // Debounced search
  const [qInput, setQInput] = useState(q);
  const debouncedQ = useDebouncedValue(qInput, 300);
  useEffect(() => {
    if (debouncedQ !== q) setParams({ q: debouncedQ });
  }, [debouncedQ, q, setParams]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [loadErr, setLoadErr] = useState<string | null>(null);

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

  const filterRef = useRef<HTMLDivElement | null>(null);

  const collectionsParam = useMemo(() => {
    if (!selectedCollections.length) return '';
    return selectedCollections.map((v) => encodeURIComponent(v)).join(',');
  }, [selectedCollections]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadErr(null);
    try {
      const url = `/api/admin/products?search=${encodeURIComponent(q)}&page=${page}${
        collectionsParam ? `&collections=${collectionsParam}` : ''
      }`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRows([]);
        setLoadErr(`Failed to load products (${res.status}).`);
        return;
      }
      setRows(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setRows([]);
      setLoadErr('Network error — could not load products.');
    } finally {
      setLoading(false);
    }
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

  const toggleVisible = useCallback(
    async (id: string, next: boolean) => {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: next })
      });
      if (res.ok) {
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, visible: next } : r)));
      } else {
        toast.error(`Could not ${next ? 'show' : 'hide'} product (${res.status}).`);
      }
    },
    [toast]
  );

  const duplicate = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/admin/products/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        toast.success('Product duplicated.');
        setParams({}, true);
        await load();
      } else {
        toast.error(`Duplicate failed (${res.status}).`);
      }
    },
    [load, setParams, toast]
  );

  const remove = useCallback(
    async (row: Row) => {
      const ok = await confirm({
        title: `Delete "${row.name}"?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true
      });
      if (!ok) return;
      const res = await fetch(`/api/admin/products/${row.id}`, { method: 'DELETE' });
      if (res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== row.id));
        toast.success(`Deleted "${row.name}".`);
      } else {
        toast.error(`Delete failed (${res.status}).`);
      }
    },
    [confirm, toast]
  );

  const bulk = useCallback(
    async (action: 'hide' | 'show' | 'delete') => {
      if (allMatchingSelected) {
        if (action === 'delete') {
          // Always know the number before deleting across pages.
          const count = await ensureMatchingCount();
          const ok = await confirm({
            title: `Delete ${count} matching product${count === 1 ? '' : 's'}?`,
            message:
              'This deletes EVERY product matching your current search/filters — including pages you have not viewed. This cannot be undone.',
            confirmLabel: `Delete ${count}`,
            danger: true,
            typeToConfirm: 'DELETE'
          });
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
          toast.success('Bulk action complete.');
          await load();
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.message ?? 'Bulk action failed');
        }
        return;
      }

      const ids = idsSelected();
      if (!ids.length) return;

      if (action === 'delete') {
        const ok = await confirm({
          title: `Delete ${ids.length} product${ids.length === 1 ? '' : 's'}?`,
          message: 'This cannot be undone.',
          confirmLabel: 'Delete',
          danger: true
        });
        if (!ok) return;
      }

      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids })
      });

      if (res.ok) {
        clearSelection();
        toast.success(
          action === 'delete'
            ? `Deleted ${ids.length} product${ids.length === 1 ? '' : 's'}.`
            : 'Done.'
        );
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message ?? 'Bulk action failed');
      }
    },
    [
      allMatchingSelected,
      q,
      selectedCollections,
      clearSelection,
      load,
      idsSelected,
      confirm,
      toast,
      ensureMatchingCount
    ]
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

  const toggleCollection = useCallback(
    (full: string) => {
      const next = selectedCollections.includes(full)
        ? selectedCollections.filter((x) => x !== full)
        : [...selectedCollections, full];
      setParams({ collections: next.map(encodeURIComponent).join(',') });
    },
    [selectedCollections, setParams]
  );

  const clearCollections = useCallback(() => {
    setCollectionQuery('');
    setParams({ collections: '' });
  }, [setParams]);

  const selectedCollectionLabels = useMemo(() => {
    return selectedCollections.map((full) => {
      const { parent, child } = parseCollection(full);
      return { full, parent, child };
    });
  }, [selectedCollections]);

  const hasFilters = Boolean(q || selectedCollections.length);
  const clearAllFilters = useCallback(() => {
    setQInput('');
    setCollectionQuery('');
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

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
      <p style={{ margin: '-8px 0 16px', color: '#6b7280', fontSize: 13.5 }}>
        Everything in your shop. Click a product name to change its price, photo or description.
      </p>

      {bulkBar}
      {pageSelectionBanner}

      <div className={styles.toolbar}>
        <input
          placeholder="Search name, SKU, brand, collection…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
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

      {loadErr && (
        <div
          style={{
            padding: '10px 14px',
            margin: '8px 0',
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            fontWeight: 600
          }}
        >
          {loadErr}{' '}
          <button type="button" className={styles.linkBtn} onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

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
                <td colSpan={8}>
                  <EmptyState
                    title="No products found"
                    hint={
                      hasFilters
                        ? 'Try widening or clearing your search and collection filters.'
                        : 'Add your first product to get started.'
                    }
                    action={
                      hasFilters
                        ? { label: 'Clear filters', onClick: clearAllFilters }
                        : { label: '+ New product', href: '/admin/products/create' }
                    }
                  />
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
                              <button className={styles.danger} onClick={() => remove(r)}>
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
        <button disabled={page <= 1} onClick={() => setParams({ page: String(page - 1) }, false)}>
          Prev
        </button>
        <span>
          Page {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => setParams({ page: String(page + 1) }, false)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
