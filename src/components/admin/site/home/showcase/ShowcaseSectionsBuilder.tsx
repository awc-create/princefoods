// src/components/admin/home/ShowcaseSectionsBuilder.tsx
'use client';

import type { HomeSectionRow } from '@/types/homeSections';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ShowcaseSectionCard from './ShowcaseSectionCard';
import { SOURCES } from './showcaseSections.constants';
import type {
  ApiGetResp,
  ApiSaveResp,
  ShowcaseCarouselConfig,
  Source
} from './showcaseSections.types';
import {
  getCfg,
  isSource,
  normalizeConfig,
  normalizeRow,
  reorderWithinFilter,
  sourceLabel,
  uid
} from './showcaseSections.utils';
import s from './ShowcaseSectionsBuilder.module.scss';

export default function ShowcaseSectionsBuilder() {
  const [rows, setRows] = useState<HomeSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [tab, setTab] = useState<Source | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);

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

          if (normalized[0]?.id) {
            setExpanded({ [normalized[0].id]: true });
          }
        } else {
          setRows([]);
          setError(json?.error ?? 'Failed to load sections');
        }
      } catch {
        if (!mounted) return;
        setRows([]);
        setError('Failed to load sections');
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

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const addSection = useCallback(
    (source: Source = 'BEST_SELLERS') => {
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
    },
    [rows, setPartial]
  );

  const update = useCallback(
    (id: string, patch: Partial<HomeSectionRow>) => {
      setPartial(rows.map((r) => (r.id === id ? normalizeRow({ ...r, ...patch }, r.position) : r)));
    },
    [rows, setPartial]
  );

  const updateConfig = useCallback(
    (id: string, patch: Partial<ShowcaseCarouselConfig>) => {
      setPartial(
        rows.map((r) => {
          if (r.id !== id) return r;
          const cfg = getCfg(r);
          const source = isSource(cfg?.source) ? cfg.source : 'BEST_SELLERS';
          const nextCfg: ShowcaseCarouselConfig = {
            ...normalizeConfig(source, cfg),
            ...patch
          };
          return normalizeRow({ ...r, config: nextCfg }, r.position);
        })
      );
    },
    [rows, setPartial]
  );

  const remove = useCallback(
    (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (row?.isLocked) return;
      setPartial(rows.filter((r) => r.id !== id));
    },
    [rows, setPartial]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  }, []);

  const onDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const onDrop = useCallback(
    (targetId: string, visibleIds: string[]) => {
      if (!dragId || dragId === targetId) return;
      const next = reorderWithinFilter(rows, visibleIds, dragId, targetId);
      setPartial(next);
      setDragId(null);
    },
    [dragId, rows, setPartial]
  );

  const visibleRows = useMemo(() => {
    if (tab === 'ALL') return rows;

    return rows.filter((r) => {
      const cfg = getCfg(r);
      const src: Source = isSource(cfg?.source) ? cfg.source : 'BEST_SELLERS';
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

  if (loading) {
    return <div className={s.loading}>Loading…</div>;
  }

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
          {visibleRows.map((row) => (
            <ShowcaseSectionCard
              key={row.id}
              row={row}
              open={!!expanded[row.id]}
              visibleIds={visibleIds}
              sourceOptions={sourceOptions}
              onToggleExpanded={toggleExpanded}
              onUpdate={update}
              onUpdateConfig={updateConfig}
              onRemove={remove}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
