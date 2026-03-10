// src/components/admin/home/ShowcaseSectionsBuilder.tsx
'use client';

import { RemoteOptionsPicker } from '@/components/admin/home/RemoteOptionsPicker';
import ImageUploader from '@/components/image/ImageUploader';
import type {
  DealsMode,
  HomeSectionProductCarouselConfig,
  HomeSectionProductSource,
  HomeSectionRow,
  HomeSectionType
} from '@/types/homeSections';
import type { CampaignKey } from '@/types/homeSettings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './ShowcaseSectionsBuilder.module.scss';

interface ApiGetResp {
  ok: boolean;
  data?: HomeSectionRow[];
  error?: string;
}
interface ApiSaveResp {
  ok: boolean;
  error?: string;
}

type Source = HomeSectionProductSource;

// Extend carousel config locally (keeps you flexible while config lives in JSON)
type ShowcaseCarouselConfig = HomeSectionProductCarouselConfig & {
  campaignKey?: CampaignKey;
  offerIds?: string[];
  campaignImageUrl?: string | null;
};

const SOURCES: Array<{
  value: Source | 'ALL';
  label: string;
  help: string;
}> = [
  { value: 'ALL', label: 'All', help: 'View all sections.' },

  { value: 'BEST_SELLERS', label: 'Best Sellers', help: 'Most sold products.' },
  { value: 'NEW_ARRIVALS', label: 'New Arrivals', help: 'Newest products.' },
  { value: 'DEALS', label: 'Deals', help: 'Discount/offer driven products.' },

  { value: 'MOST_CLICKED', label: 'Most Clicked', help: 'Ranked by clicks.' },
  { value: 'LEAST_CLICKED', label: 'Least Clicked', help: 'Lower clicks (discovery).' },
  { value: 'LEAST_SOLD', label: 'Least Sold', help: 'Lower sales (give exposure).' },

  { value: 'CATEGORY', label: 'Category', help: 'Show products from a category.' },
  { value: 'COLLECTION', label: 'Collection', help: 'Show products from a collection.' },
  { value: 'MANUAL', label: 'Manual', help: 'Pick specific products.' },
  { value: 'CAMPAIGN', label: 'Campaign', help: 'Seasonal / promo grouping.' }
];

const DEALS_MODES: Array<{ value: DealsMode; label: string; help: string }> = [
  { value: 'OFFER_ENGINE', label: 'Offer Engine', help: 'Use Offer table / engine logic.' },
  { value: 'DISCOUNT_FIELDS', label: 'Discount Fields', help: 'Use product discount fields.' },
  { value: 'RIBBON', label: 'Ribbon', help: 'Use ribbon/flag field.' }
];

const CAMPAIGNS: CampaignKey[] = [
  'onam',
  'vishu',
  'diwali',
  'pongal',
  'ramadan_eid',
  'easter',
  'christmas',
  'new_year',
  'summer_bbq',
  'back_to_uni',
  'custom'
];

function uid() {
  return `sec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toIsoOrNull(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function safeTitle(x: unknown) {
  return String(x ?? '').slice(0, 80);
}

function safeSubtitle(x: unknown) {
  const t = String(x ?? '');
  return t ? t.slice(0, 140) : null;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

function isSource(x: unknown): x is Source {
  return typeof x === 'string' && SOURCES.some((s) => s.value === x);
}

function getCfg(row: HomeSectionRow): ShowcaseCarouselConfig | null {
  const c = row.config ?? null;
  if (!c || !isRecord(c)) return null;
  if (c.kind !== 'PRODUCT_CAROUSEL') return null;
  return c as unknown as ShowcaseCarouselConfig;
}

function normalizeConfig(
  source: Source,
  cfg: ShowcaseCarouselConfig | null
): ShowcaseCarouselConfig {
  const limit = clamp(Number(cfg?.limit ?? 16), 1, 48);

  const base: ShowcaseCarouselConfig = {
    kind: 'PRODUCT_CAROUSEL',
    source,
    limit
  };

  if (source === 'COLLECTION') {
    base.collection = typeof cfg?.collection === 'string' ? cfg.collection : '';
  }

  if (source === 'CATEGORY') {
    base.categoryId = typeof cfg?.categoryId === 'string' ? cfg.categoryId : '';
  }

  if (source === 'MANUAL') {
    base.productIds = Array.isArray(cfg?.productIds) ? cfg!.productIds.filter(Boolean) : [];
  }

  if (source === 'DEALS') {
    base.dealsMode = (cfg?.dealsMode as DealsMode | undefined) ?? 'OFFER_ENGINE';
    base.offerIds = Array.isArray((cfg as ShowcaseCarouselConfig | null)?.offerIds)
      ? (cfg as ShowcaseCarouselConfig).offerIds!.filter(Boolean)
      : [];
  }

  if (source === 'CAMPAIGN') {
    base.campaignKey = (cfg?.campaignKey as CampaignKey | undefined) ?? 'custom';
    base.campaignImageUrl =
      typeof (cfg as ShowcaseCarouselConfig | null)?.campaignImageUrl === 'string'
        ? (cfg as ShowcaseCarouselConfig).campaignImageUrl
        : null;
  }

  if (source === 'MOST_CLICKED' || source === 'LEAST_CLICKED' || source === 'LEAST_SOLD') {
    base.minAgeDays = clamp(Number(cfg?.minAgeDays ?? 14), 0, 365);
  }

  return base;
}

function normalizeRow(raw: HomeSectionRow, position: number): HomeSectionRow {
  const type: HomeSectionType = 'PRODUCT_CAROUSEL';
  const cfg = getCfg(raw);

  const source: Source = isSource(cfg?.source) ? cfg!.source : 'BEST_SELLERS';
  const config = normalizeConfig(source, cfg);

  return {
    id: raw.id || uid(),
    title: safeTitle(raw.title) || 'Section',
    subtitle: raw.subtitle ? safeSubtitle(raw.subtitle) : null,

    type,
    enabled: raw.enabled !== false,
    position,

    startAt: raw.startAt ?? null,
    endAt: raw.endAt ?? null,

    isLocked: !!raw.isLocked,
    config,

    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

function sourceLabel(src: Source) {
  return SOURCES.find((x) => x.value === src)?.label ?? src;
}

function reorderWithinFilter<T extends { id: string }>(
  all: T[],
  visibleIds: string[],
  dragId: string,
  targetId: string
) {
  const visibleSet = new Set(visibleIds);
  const visible = all.filter((x) => visibleSet.has(x.id));
  const hidden = all.filter((x) => !visibleSet.has(x.id));

  const from = visible.findIndex((x) => x.id === dragId);
  const to = visible.findIndex((x) => x.id === targetId);
  if (from < 0 || to < 0) return all;

  const nextVisible = [...visible];
  const [moved] = nextVisible.splice(from, 1);
  nextVisible.splice(to, 0, moved);

  // Merge back: keep hidden in place relative to themselves, but visible block becomes “the list order”
  // Simplest: just return [...nextVisible, ...hidden] and normalizeRow will rewrite positions.
  return [...nextVisible, ...hidden];
}

export default function ShowcaseSectionsBuilder() {
  const [rows, setRows] = useState<HomeSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [tab, setTab] = useState<Source | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // load
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/admin/site/home/sections/get', { cache: 'no-store' });
        const json = (await res.json()) as ApiGetResp;

        if (!mounted) return;

        if (json?.ok && Array.isArray(json.data)) {
          const normalized = json.data.map((r, i) => normalizeRow(r, i));
          setRows(normalized);
          setDirty(false);
          setError(null);

          // Expand first row by default
          if (normalized[0]?.id) setExpanded({ [normalized[0].id]: true });
        } else {
          setError(json?.error ?? 'Failed to load sections');
          setRows([]);
        }
      } catch {
        if (mounted) {
          setError('Failed to load sections');
          setRows([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setPartial = useCallback((next: HomeSectionRow[]) => {
    setRows(next.map((r, i) => normalizeRow(r, i)));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = { sections: rows.map((r, i) => normalizeRow(r, i)) };

      const res = await fetch('/api/admin/site/home/sections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = (await res.json()) as ApiSaveResp;
      if (!json?.ok) throw new Error(json?.error ?? 'Save failed');

      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [rows]);

  // Cmd/Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, save]);

  // warn on unload
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const addSection = (source: Source = 'BEST_SELLERS') => {
    const meta = SOURCES.find((x) => x.value === source);

    const row: HomeSectionRow = normalizeRow(
      {
        id: uid(),
        title: meta?.label ?? 'Section',
        subtitle: null,
        type: 'PRODUCT_CAROUSEL',
        enabled: true,
        position: 0,
        config: normalizeConfig(source, null)
      } as HomeSectionRow,
      0
    );

    setPartial([row, ...rows]);
    setExpanded((m) => ({ ...m, [row.id]: true }));
  };

  const update = (id: string, patch: Partial<HomeSectionRow>) => {
    setPartial(rows.map((r) => (r.id === id ? normalizeRow({ ...r, ...patch }, r.position) : r)));
  };

  const updateConfig = (id: string, patch: Partial<ShowcaseCarouselConfig>) => {
    setPartial(
      rows.map((r) => {
        if (r.id !== id) return r;
        const cfg = getCfg(r);
        const source = isSource(cfg?.source) ? cfg!.source : 'BEST_SELLERS';
        const nextCfg: ShowcaseCarouselConfig = { ...normalizeConfig(source, cfg), ...patch };
        return normalizeRow({ ...r, config: nextCfg }, r.position);
      })
    );
  };

  const remove = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (row?.isLocked) return;
    setPartial(rows.filter((r) => r.id !== id));
  };

  const toggleExpanded = (id: string) => {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  };

  // drag & drop reorder (within current tab view)
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string, visibleIds: string[]) => {
    if (!dragId || dragId === targetId) return;
    const next = reorderWithinFilter(rows, visibleIds, dragId, targetId);
    setPartial(next);
    setDragId(null);
  };

  const visibleRows = useMemo(() => {
    if (tab === 'ALL') return rows;
    return rows.filter((r) => {
      const cfg = getCfg(r);
      const src: Source = isSource(cfg?.source) ? cfg!.source : 'BEST_SELLERS';
      return src === tab;
    });
  }, [rows, tab]);

  const visibleIds = useMemo(() => visibleRows.map((r) => r.id), [visibleRows]);

  const sourceOptions = useMemo(
    () =>
      SOURCES.filter((x) => x.value !== 'ALL').map((k) => (
        <option key={k.value} value={k.value}>
          {k.label}
        </option>
      )),
    []
  );

  if (loading) return <div className={s.loading}>Loading…</div>;

  return (
    <div className={s.wrap}>
      <div className={s.header}>
        <div>
          <h2 className={s.title}>Showcase Sections</h2>
          <p className={s.subtitle}>
            Create multiple sections per type, reorder by drag, and power the storefront using real
            DB categories/products/offers.
          </p>
        </div>

        <div className={s.actions}>
          {error && <span className={`${s.status} ${s.statusError}`}>{error}</span>}
          {!error && dirty && !saving && (
            <span className={`${s.status} ${s.statusUnsaved}`}>Unsaved</span>
          )}
          {savedAt && !dirty && !error && (
            <span className={`${s.status} ${s.statusSaved}`}>Saved</span>
          )}

          <button className={s.saveBtn} onClick={save} disabled={!dirty || saving} type="button">
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={s.tabsCard}>
        <div className={s.tabsRow}>
          <div className={s.tabs}>
            {SOURCES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${s.tabBtn} ${tab === t.value ? s.tabBtnActive : ''}`}
                onClick={() => setTab(t.value)}
                title={t.help}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className={s.tabActions}>
            <button
              className={s.secondary}
              type="button"
              onClick={() => addSection((tab === 'ALL' ? 'BEST_SELLERS' : tab) as Source)}
            >
              + Add {tab === 'ALL' ? 'Section' : sourceLabel(tab as Source)}
            </button>
          </div>
        </div>

        <div className={s.tabHint}>
          {tab === 'ALL'
            ? 'You are viewing all sections.'
            : `You are viewing: ${sourceLabel(tab as Source)}. Add more sections in this tab.`}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <div className={s.empty}>
          No sections in this tab yet. Click <b>“Add”</b> above.
        </div>
      ) : (
        <div className={s.list}>
          {visibleRows.map((row) => {
            const cfg = getCfg(row);
            const source: Source = isSource(cfg?.source) ? cfg!.source : 'BEST_SELLERS';

            const meta = SOURCES.find((x) => x.value === source);
            const open = !!expanded[row.id];

            const needsMinAge =
              source === 'MOST_CLICKED' || source === 'LEAST_CLICKED' || source === 'LEAST_SOLD';

            const needsDealsMode = source === 'DEALS';
            const needsCategory = source === 'CATEGORY';
            const needsCollection = source === 'COLLECTION';
            const needsManual = source === 'MANUAL';
            const needsCampaign = source === 'CAMPAIGN';

            const limit = Number(cfg?.limit ?? 16);

            return (
              <div
                key={row.id}
                className={`${s.sectionCard} ${open ? s.sectionCardOpen : ''}`}
                draggable
                onDragStart={() => onDragStart(row.id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(row.id, visibleIds)}
                title="Drag to reorder within this tab"
              >
                {/* Header bar */}
                <div className={s.sectionBar}>
                  <button
                    type="button"
                    className={s.sectionBarLeft}
                    onClick={() => toggleExpanded(row.id)}
                    aria-expanded={open}
                  >
                    <span className={s.chev}>{open ? '▾' : '▸'}</span>
                    <span className={s.badge}>{sourceLabel(source)}</span>
                    <span className={s.sectionName}>{row.title || 'Section'}</span>
                    {row.subtitle ? <span className={s.sectionMini}>{row.subtitle}</span> : null}
                  </button>

                  <div className={s.sectionBarRight}>
                    <label className={s.smallToggle}>
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => update(row.id, { enabled: e.target.checked })}
                      />
                      <span>{row.enabled !== false ? 'Enabled' : 'Hidden'}</span>
                    </label>

                    <button
                      className={s.danger}
                      type="button"
                      disabled={!!row.isLocked}
                      onClick={() => remove(row.id)}
                      title={row.isLocked ? 'Locked section cannot be deleted' : 'Delete section'}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Body */}
                {open && (
                  <div className={s.sectionBody}>
                    <div className={s.sectionMeta}>
                      <div className={s.kindHelp}>{meta?.help ?? ''}</div>
                      <div className={s.smallNote}>ID: {row.id}</div>
                    </div>

                    <div className={s.grid}>
                      <label className={s.field}>
                        <span className={s.label}>Title</span>
                        <input
                          className={s.input}
                          value={row.title}
                          onChange={(e) => update(row.id, { title: e.target.value })}
                          placeholder="Section title"
                        />
                      </label>

                      <label className={s.field}>
                        <span className={s.label}>Source</span>
                        <select
                          className={s.input}
                          value={source}
                          onChange={(e) => {
                            const next = e.target.value as Source;
                            const nextCfg = normalizeConfig(next, cfg);
                            update(row.id, { config: nextCfg, title: sourceLabel(next) });
                          }}
                        >
                          {sourceOptions}
                        </select>
                        <span className={s.help}>{meta?.help ?? ''}</span>
                      </label>

                      <label className={s.field}>
                        <span className={s.label}>Limit</span>
                        <input
                          className={s.input}
                          type="number"
                          min={1}
                          max={48}
                          value={limit}
                          onChange={(e) =>
                            updateConfig(row.id, { limit: clamp(Number(e.target.value), 1, 48) })
                          }
                        />
                        <span className={s.help}>How many items to show.</span>
                      </label>

                      <label className={s.field}>
                        <span className={s.label}>Subtitle (optional)</span>
                        <input
                          className={s.input}
                          value={row.subtitle ?? ''}
                          onChange={(e) => update(row.id, { subtitle: e.target.value })}
                          placeholder="Short helper text (optional)"
                        />
                      </label>

                      <label className={s.field}>
                        <span className={s.label}>Start At (optional)</span>
                        <input
                          className={s.input}
                          placeholder="YYYY-MM-DD or ISO"
                          value={row.startAt ?? ''}
                          onChange={(e) => update(row.id, { startAt: toIsoOrNull(e.target.value) })}
                        />
                      </label>

                      <label className={s.field}>
                        <span className={s.label}>End At (optional)</span>
                        <input
                          className={s.input}
                          placeholder="YYYY-MM-DD or ISO"
                          value={row.endAt ?? ''}
                          onChange={(e) => update(row.id, { endAt: toIsoOrNull(e.target.value) })}
                        />
                      </label>

                      {needsDealsMode && (
                        <label className={s.fieldFull}>
                          <span className={s.label}>Deals Mode</span>
                          <select
                            className={s.input}
                            value={(cfg?.dealsMode ?? 'OFFER_ENGINE') as DealsMode}
                            onChange={(e) =>
                              updateConfig(row.id, { dealsMode: e.target.value as DealsMode })
                            }
                          >
                            {DEALS_MODES.map((m) => (
                              <option key={m.value} value={m.value}>
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <span className={s.help}>
                            {DEALS_MODES.find((m) => m.value === (cfg?.dealsMode ?? 'OFFER_ENGINE'))
                              ?.help ?? ''}
                          </span>

                          <div className={s.block}>
                            <RemoteOptionsPicker
                              label="Restrict to specific offers (optional)"
                              placeholder="Search offers by name or code…"
                              endpoint="/api/admin/site/home/sections/options/offers"
                              multiple
                              value={
                                Array.isArray((cfg as ShowcaseCarouselConfig | null)?.offerIds)
                                  ? (cfg as ShowcaseCarouselConfig).offerIds
                                  : []
                              }
                              onChange={(next) =>
                                updateConfig(row.id, {
                                  offerIds: Array.isArray(next) ? next : []
                                })
                              }
                            />
                            <div className={s.help}>
                              Leave empty to show all deals. If set, your resolver can filter to
                              these offers.
                            </div>
                          </div>
                        </label>
                      )}

                      {needsMinAge && (
                        <label className={s.fieldFull}>
                          <span className={s.label}>Min Age Days</span>
                          <input
                            className={s.input}
                            type="number"
                            min={0}
                            max={365}
                            value={Number(cfg?.minAgeDays ?? 14)}
                            onChange={(e) =>
                              updateConfig(row.id, {
                                minAgeDays: clamp(Number(e.target.value), 0, 365)
                              })
                            }
                          />
                          <span className={s.help}>
                            Stops brand-new products dominating “least” lists.
                          </span>
                        </label>
                      )}

                      {needsCategory && (
                        <div className={s.fieldFull}>
                          <RemoteOptionsPicker
                            label="Category"
                            placeholder="Search categories…"
                            endpoint="/api/admin/site/home/sections/options/categories"
                            value={String(cfg?.categoryId ?? '') || null}
                            onChange={(next) =>
                              updateConfig(row.id, {
                                categoryId: typeof next === 'string' ? next : ''
                              })
                            }
                          />
                        </div>
                      )}

                      {needsCollection && (
                        <div className={s.fieldFull}>
                          <RemoteOptionsPicker
                            label="Collection"
                            placeholder="Search collections…"
                            endpoint="/api/admin/site/home/sections/options/collections"
                            value={String(cfg?.collection ?? '') || null}
                            onChange={(next) =>
                              updateConfig(row.id, {
                                collection: typeof next === 'string' ? next : ''
                              })
                            }
                          />
                        </div>
                      )}

                      {needsCampaign && (
                        <div className={s.fieldFull}>
                          <div className={s.block}>
                            <label className={s.fieldFull}>
                              <span className={s.label}>Campaign Key</span>
                              <select
                                className={s.input}
                                value={(cfg?.campaignKey ?? 'custom') as CampaignKey}
                                onChange={(e) =>
                                  updateConfig(row.id, {
                                    campaignKey: e.target.value as CampaignKey
                                  })
                                }
                              >
                                {CAMPAIGNS.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                              </select>
                              <span className={s.help}>Seasonal/promotional grouping.</span>
                            </label>

                            <div className={s.mediaRow}>
                              <div className={s.mediaHint}>
                                <div className={s.label}>Campaign image (optional)</div>
                                <div className={s.help}>
                                  Upload 1 image to push the celebration campaign on the storefront.
                                </div>
                              </div>

                              <div className={s.mediaUploader}>
                                <ImageUploader
                                  single
                                  pathSegments={[
                                    'pages',
                                    'home',
                                    'showcase',
                                    String(cfg?.campaignKey ?? row.id)
                                  ]}
                                  itemName="main-image"
                                  files={
                                    (cfg as ShowcaseCarouselConfig | null)?.campaignImageUrl
                                      ? [(cfg as ShowcaseCarouselConfig).campaignImageUrl as string]
                                      : []
                                  }
                                  setFiles={(urls) =>
                                    updateConfig(row.id, {
                                      campaignImageUrl: urls?.[0] ?? null
                                    })
                                  }
                                  accept="image/*"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {needsManual && (
                        <div className={s.fieldFull}>
                          <RemoteOptionsPicker
                            label="Manual products"
                            placeholder="Search products by name or SKU…"
                            endpoint="/api/admin/site/home/sections/options/products"
                            multiple
                            value={Array.isArray(cfg?.productIds) ? cfg!.productIds : []}
                            onChange={(next) =>
                              updateConfig(row.id, { productIds: Array.isArray(next) ? next : [] })
                            }
                          />
                          <div className={s.help}>
                            This replaces comma-separated product IDs. Pick directly from your DB.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
