'use client';

import type { HomeSectionRow } from '@/types/homeSections';
import { SOURCES } from './showcaseSections.constants';
import type { ShowcaseCarouselConfig, Source } from './showcaseSections.types';
import {
  clamp,
  getCfg,
  isSource,
  normalizeConfig,
  sourceLabel,
  toIsoOrNull
} from './showcaseSections.utils';
import s from './ShowcaseSectionsBuilder.module.scss';
import ShowcaseSectionSpecificFields from './ShowcaseSectionSpecificFields';

interface Props {
  row: HomeSectionRow;
  open: boolean;
  visibleIds: string[];
  sourceOptions: React.ReactNode;
  onToggleExpanded: (id: string) => void;
  onUpdate: (id: string, patch: Partial<HomeSectionRow>) => void;
  onUpdateConfig: (id: string, patch: Partial<ShowcaseCarouselConfig>) => void;
  onRemove: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string, visibleIds: string[]) => void;
}

export default function ShowcaseSectionCard({
  row,
  open,
  visibleIds,
  sourceOptions,
  onToggleExpanded,
  onUpdate,
  onUpdateConfig,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop
}: Props) {
  const cfg = getCfg(row);
  const source: Source = isSource(cfg?.source) ? cfg.source : 'BEST_SELLERS';
  const meta = SOURCES.find((x) => x.value === source);
  const limit = Number(cfg?.limit ?? 16);

  return (
    <div
      className={`${s.sectionCard} ${open ? s.sectionCardOpen : ''}`}
      onDragOver={onDragOver}
      onDrop={() => onDrop(row.id, visibleIds)}
    >
      <div
        className={s.sectionBar}
        draggable
        onDragStart={() => onDragStart(row.id)}
        title="Drag to reorder within this tab"
      >
        <button
          type="button"
          className={s.sectionBarLeft}
          onClick={() => onToggleExpanded(row.id)}
          aria-expanded={open}
        >
          <span className={s.chev}>{open ? '▾' : '▸'}</span>
          <span className={s.badge}>{sourceLabel(source)}</span>
          <span className={s.sectionName}>{row.title || 'Section'}</span>
          {row.subtitle ? <span className={s.sectionMini}>{row.subtitle}</span> : null}
        </button>

        <div
          className={s.sectionBarRight}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <label className={s.smallToggle}>
            <input
              type="checkbox"
              checked={row.enabled !== false}
              onChange={(e) => onUpdate(row.id, { enabled: e.target.checked })}
            />
            <span>{row.enabled !== false ? 'Enabled' : 'Hidden'}</span>
          </label>

          <button
            className={s.danger}
            type="button"
            disabled={!!row.isLocked}
            onClick={() => onRemove(row.id)}
            title={row.isLocked ? 'Locked section cannot be deleted' : 'Delete section'}
          >
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div
          className={s.sectionBody}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
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
                onChange={(e) => onUpdate(row.id, { title: e.target.value })}
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

                  onUpdate(row.id, {
                    config: nextCfg,
                    title: sourceLabel(next)
                  });
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
                  onUpdateConfig(row.id, {
                    limit: clamp(Number(e.target.value), 1, 48)
                  })
                }
              />
              <span className={s.help}>How many items to show.</span>
            </label>

            <label className={s.field}>
              <span className={s.label}>Subtitle (optional)</span>
              <input
                className={s.input}
                value={row.subtitle ?? ''}
                onChange={(e) => onUpdate(row.id, { subtitle: e.target.value })}
                placeholder="Short helper text (optional)"
              />
            </label>

            <label className={s.field}>
              <span className={s.label}>Start At (optional)</span>
              <input
                className={s.input}
                placeholder="YYYY-MM-DD or ISO"
                value={row.startAt ?? ''}
                onChange={(e) => onUpdate(row.id, { startAt: toIsoOrNull(e.target.value) })}
              />
            </label>

            <label className={s.field}>
              <span className={s.label}>End At (optional)</span>
              <input
                className={s.input}
                placeholder="YYYY-MM-DD or ISO"
                value={row.endAt ?? ''}
                onChange={(e) => onUpdate(row.id, { endAt: toIsoOrNull(e.target.value) })}
              />
            </label>

            <ShowcaseSectionSpecificFields
              rowId={row.id}
              source={source}
              cfg={cfg}
              updateConfig={onUpdateConfig}
            />
          </div>
        </div>
      )}
    </div>
  );
}
