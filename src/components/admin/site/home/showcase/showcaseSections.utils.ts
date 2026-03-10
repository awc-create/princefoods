// src/components/admin/site/home/showcase/showcaseSections.utils.ts
import type { DealsMode, HomeSectionRow, HomeSectionType } from '@/types/homeSections';
import type { CampaignKey } from '@/types/homeSettings';
import { CAMPAIGNS, DEFAULT_DEALS_MODE, SOURCES } from './showcaseSections.constants';
import type { ShowcaseCarouselConfig, Source } from './showcaseSections.types';

export function uid() {
  return `sec_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function toIsoOrNull(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function safeTitle(x: unknown) {
  return String(x ?? '').slice(0, 80);
}

export function safeSubtitle(x: unknown) {
  const t = String(x ?? '');
  return t ? t.slice(0, 140) : null;
}

export function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

export function isSource(x: unknown): x is Source {
  return typeof x === 'string' && SOURCES.some((s) => s.value === x);
}

export function getCfg(row: HomeSectionRow): ShowcaseCarouselConfig | null {
  const c = row.config;
  if (!isRecord(c)) return null;
  if (c.kind !== 'PRODUCT_CAROUSEL') return null;

  return c as unknown as ShowcaseCarouselConfig;
}

export function normalizeConfig(
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
    base.productIds = Array.isArray(cfg?.productIds) ? cfg.productIds.filter(Boolean) : [];
  }

  if (source === 'DEALS') {
    base.dealsMode = (cfg?.dealsMode as DealsMode | undefined) ?? DEFAULT_DEALS_MODE;
    base.dealsSelectionMode = cfg?.dealsSelectionMode === 'SELECTED' ? 'SELECTED' : 'ALL_ACTIVE';
    base.offerIds = Array.isArray(cfg?.offerIds) ? cfg.offerIds.filter(Boolean) : [];
  }

  if (source === 'CAMPAIGN') {
    const campaignKey =
      cfg?.campaignKey && CAMPAIGNS.includes(cfg.campaignKey)
        ? cfg.campaignKey
        : ('custom' as CampaignKey);

    base.campaignKey = campaignKey;
    base.campaignImageUrl = typeof cfg?.campaignImageUrl === 'string' ? cfg.campaignImageUrl : null;
  }

  if (source === 'MOST_CLICKED' || source === 'LEAST_CLICKED' || source === 'LEAST_SOLD') {
    base.minAgeDays = clamp(Number(cfg?.minAgeDays ?? 14), 0, 365);
  }

  return base;
}

export function normalizeRow(raw: HomeSectionRow, position: number): HomeSectionRow {
  const type: HomeSectionType = 'PRODUCT_CAROUSEL';
  const cfg = getCfg(raw);

  const source: Source = isSource(cfg?.source) ? cfg.source : 'BEST_SELLERS';
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

export function sourceLabel(src: Source) {
  return SOURCES.find((x) => x.value === src)?.label ?? src;
}

export function reorderWithinFilter<T extends { id: string }>(
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

  return [...nextVisible, ...hidden];
}
