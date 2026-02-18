'use client';

import type { HomeSectionKind, HomeSectionRow, HomeSectionsSettings } from '@/types/homeSettings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import s from './HomeSectionsBuilder.module.scss';

const KINDS: Array<{ kind: HomeSectionKind; label: string; help: string }> = [
  { kind: 'best_sellers', label: 'Best Sellers', help: 'Most sold products.' },
  { kind: 'on_sale', label: 'On Sale', help: 'Discounted products.' },
  { kind: 'b1g1', label: 'Buy 1 Get 1', help: 'BOGOF items.' },
  { kind: 'new_arrivals', label: 'New Arrivals', help: 'Newest products.' },
  { kind: 'trending', label: 'Trending', help: 'High engagement / rising interest.' },
  { kind: 'top_rated', label: 'Top Rated', help: 'Highest rated products.' },
  { kind: 'seasonal', label: 'Seasonal Picks', help: 'Season / campaign products.' },
  {
    kind: 'hidden_gems_clicks',
    label: 'Hidden Gems',
    help: 'Great products getting fewer clicks (discoverable).'
  },
  {
    kind: 'hidden_gems_sales',
    label: 'Hidden Gems (Value Picks)',
    help: 'Great products with fewer sales (give exposure).'
  }
];

const DEFAULT: HomeSectionsSettings = {
  enabled: false, // ✅ default OFF
  sections: []
};

function uid() {
  return `sec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function HomeSectionsBuilder() {
  const [data, setData] = useState<HomeSectionsSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // load
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/admin/site/home/sections/get', { cache: 'no-store' });
        const json = (await res.json()) as {
          ok: boolean;
          data?: HomeSectionsSettings;
          error?: string;
        };

        if (!mounted) return;

        if (json?.ok && json.data) {
          // if malformed, fall back safely
          const safe: HomeSectionsSettings = {
            enabled: !!json.data.enabled,
            sections: Array.isArray(json.data.sections) ? json.data.sections : []
          };
          setData(safe);
          setDirty(false);
        } else {
          setError(json?.error ?? 'Failed to load');
        }
      } catch {
        if (mounted) setError('Failed to load');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setPartial = useCallback((patch: Partial<HomeSectionsSettings>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/site/home/sections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json?.ok) throw new Error(json?.error ?? 'Save failed');

      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [data]);

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

  const addSection = (kind?: HomeSectionKind) => {
    const k = kind ?? 'best_sellers';
    const label = KINDS.find((x) => x.kind === k)?.label ?? 'Section';

    const row: HomeSectionRow = {
      id: uid(),
      enabled: true,
      kind: k,
      title: label,
      limit: 12,
      note: ''
    };

    setPartial({ sections: [row, ...data.sections] });
  };

  const update = (id: string, patch: Partial<HomeSectionRow>) => {
    setPartial({
      sections: data.sections.map((r) => (r.id === id ? { ...r, ...patch } : r))
    });
  };

  const remove = (id: string) => {
    setPartial({ sections: data.sections.filter((r) => r.id !== id) });
  };

  // reorder (simple up/down + optional drag)
  const move = (id: string, dir: -1 | 1) => {
    const idx = data.sections.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= data.sections.length) return;

    const next = [...data.sections];
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    setPartial({ sections: next });
  };

  // drag & drop
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;

    const from = data.sections.findIndex((r) => r.id === dragId);
    const to = data.sections.findIndex((r) => r.id === targetId);
    if (from < 0 || to < 0) return;

    const next = [...data.sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    setPartial({ sections: next });
    setDragId(null);
  };

  const kindOptions = useMemo(
    () =>
      KINDS.map((k) => (
        <option key={k.kind} value={k.kind}>
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
          <h1 className={s.title}>Home Sections</h1>
          <p className={s.subtitle}>
            Build and reorder the sections shown on the home page. Default is off until you enable
            it.
          </p>
        </div>

        <div className={s.actions}>
          {error && <span className={`${s.status} ${s.statusError}`}>{error}</span>}
          {!error && dirty && !saving && (
            <span className={`${s.status} ${s.statusUnsaved}`}>Unsaved changes</span>
          )}
          {savedAt && !dirty && !error && (
            <span className={`${s.status} ${s.statusSaved}`}>Saved</span>
          )}

          <button className={s.saveBtn} onClick={save} disabled={!dirty || saving}>
            {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      <div className={s.card}>
        <div className={s.topRow}>
          <div className={s.master}>
            <div className={s.masterLabel}>Enable Home Sections</div>
            <div className={s.masterHelp}>
              When off, your home page uses the standard layout. When on, it renders the ordered
              list below.
            </div>
          </div>

          <label className={s.toggle}>
            <input
              type="checkbox"
              checked={data.enabled}
              onChange={(e) => setPartial({ enabled: e.target.checked })}
            />
            <span className={s.toggleUi} aria-hidden />
            <span className={s.toggleText}>{data.enabled ? 'On' : 'Off'}</span>
          </label>
        </div>

        <div className={s.addBar}>
          <button className={s.secondary} type="button" onClick={() => addSection()}>
            + Add Section
          </button>

          <div className={s.quickAdds}>
            {KINDS.slice(0, 6).map((k) => (
              <button
                key={k.kind}
                className={s.quickBtn}
                type="button"
                onClick={() => addSection(k.kind)}
                title={k.help}
              >
                + {k.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {data.sections.length === 0 ? (
        <div className={s.empty}>
          No sections yet. Add one above — you can keep it off until you’re ready.
        </div>
      ) : (
        <div className={s.list}>
          {data.sections.map((row) => {
            const meta = KINDS.find((k) => k.kind === row.kind);
            return (
              <div
                key={row.id}
                className={s.sectionCard}
                draggable
                onDragStart={() => onDragStart(row.id)}
                onDragOver={onDragOver}
                onDrop={() => onDrop(row.id)}
                title="Drag to reorder"
              >
                <div className={s.sectionTop}>
                  <div className={s.sectionTitleWrap}>
                    <input
                      className={s.inputTitle}
                      value={row.title}
                      onChange={(e) => update(row.id, { title: e.target.value })}
                      placeholder="Section title"
                    />
                    <div className={s.kindHelp}>{meta?.help ?? ''}</div>
                  </div>

                  <div className={s.sectionControls}>
                    <label className={s.smallToggle}>
                      <input
                        type="checkbox"
                        checked={row.enabled !== false}
                        onChange={(e) => update(row.id, { enabled: e.target.checked })}
                      />
                      <span>{row.enabled !== false ? 'Enabled' : 'Hidden'}</span>
                    </label>

                    <button
                      className={s.iconBtn}
                      type="button"
                      onClick={() => move(row.id, -1)}
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      className={s.iconBtn}
                      type="button"
                      onClick={() => move(row.id, 1)}
                      title="Move down"
                    >
                      ↓
                    </button>

                    <button className={s.danger} type="button" onClick={() => remove(row.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                <div className={s.grid}>
                  <label className={s.field}>
                    <span className={s.label}>Type</span>
                    <select
                      className={s.input}
                      value={row.kind}
                      onChange={(e) => update(row.id, { kind: e.target.value as HomeSectionKind })}
                    >
                      {kindOptions}
                    </select>
                  </label>

                  <label className={s.field}>
                    <span className={s.label}>Limit</span>
                    <input
                      className={s.input}
                      type="number"
                      min={1}
                      max={48}
                      value={row.limit}
                      onChange={(e) => update(row.id, { limit: Number(e.target.value) })}
                    />
                    <span className={s.help}>How many items to show in the slider.</span>
                  </label>

                  <label className={s.fieldFull}>
                    <span className={s.label}>Note (internal)</span>
                    <input
                      className={s.input}
                      value={row.note ?? ''}
                      onChange={(e) => update(row.id, { note: e.target.value })}
                      placeholder="Optional internal note (not shown to customers)"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
