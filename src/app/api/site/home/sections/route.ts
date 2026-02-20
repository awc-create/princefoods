// src/app/api/site/home/sections/route.ts
import type { CartLine, OfferAdminForm } from '@/lib/offers-engine';
import { evaluateOffers } from '@/lib/offers-engine';
import { prisma } from '@/lib/prisma';
import type { HomeSectionsResolvedDTO } from '@/types/homeResolved';
import type {
  DealsMode,
  HomeSectionProductCarouselConfig,
  HomeSectionProductSource
} from '@/types/homeSections';
import type { CampaignKey } from '@/types/homeSettings';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Config = HomeSectionProductCarouselConfig;

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}
function isString(x: unknown): x is string {
  return typeof x === 'string';
}
function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function nowInWindow(now: Date, startAt?: string | null, endAt?: string | null) {
  const t = now.getTime();
  const s = startAt ? new Date(startAt).getTime() : null;
  const e = endAt ? new Date(endAt).getTime() : null;

  if (s != null && !Number.isNaN(s) && t < s) return false;
  if (e != null && !Number.isNaN(e) && t > e) return false;
  return true;
}

const SOURCES: HomeSectionProductSource[] = [
  'BEST_SELLERS',
  'NEW_ARRIVALS',
  'DEALS',
  'MOST_CLICKED',
  'LEAST_CLICKED',
  'LEAST_SOLD',
  'COLLECTION',
  'CATEGORY',
  'MANUAL',
  'CAMPAIGN'
];

function isSource(x: unknown): x is HomeSectionProductSource {
  return isString(x) && (SOURCES as string[]).includes(x);
}

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

function isCampaignKey(x: unknown): x is CampaignKey {
  return isString(x) && (CAMPAIGNS as string[]).includes(x);
}

function getCfgFromJson(config: unknown): Config | null {
  if (!isRecord(config)) return null;

  if (config.kind !== 'PRODUCT_CAROUSEL') return null;
  if (!isSource(config.source)) return null;

  const out: Config = {
    kind: 'PRODUCT_CAROUSEL',
    source: config.source,
    limit: isNumber(config.limit) ? config.limit : 16
  };

  if (isString(config.collection)) out.collection = config.collection;
  if (isString(config.categoryId)) out.categoryId = config.categoryId;

  if (Array.isArray(config.productIds)) {
    out.productIds = config.productIds
      .filter((x): x is string => isString(x) && x.trim().length > 0)
      .map((x) => x.trim());
  }

  if (isString(config.dealsMode)) {
    out.dealsMode = config.dealsMode as Config['dealsMode'];
  }

  // ✅ NEW: offer restriction IDs (multi-select)
  if (Array.isArray(config.offerIds)) {
    out.offerIds = config.offerIds
      .filter((x): x is string => isString(x) && x.trim().length > 0)
      .map((x) => x.trim());
  }

  if (isCampaignKey(config.campaignKey)) {
    out.campaignKey = config.campaignKey;
  }

  if (isNumber(config.minAgeDays)) {
    out.minAgeDays = Math.max(0, Math.min(365, config.minAgeDays));
  }

  // clamp limit
  out.limit = Math.max(1, Math.min(48, Number(out.limit ?? 16)));

  return out;
}

async function idsFrom(
  where: Prisma.ProductWhereInput,
  orderBy: Prisma.ProductOrderByWithRelationInput,
  take: number
) {
  const rows = await prisma.product.findMany({
    where,
    orderBy,
    take,
    select: { id: true }
  });
  return rows.map((r) => r.id);
}

function priceToPence(price: number | null): number {
  const n = Number(price ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

async function idsFromOfferEngine(cfg: Config, take: number): Promise<string[]> {
  const offerIds = Array.isArray(cfg.offerIds) ? cfg.offerIds.filter(Boolean) : [];

  const offersDb = await prisma.offer.findMany({
    where: {
      status: 'ACTIVE',
      ...(offerIds.length ? { id: { in: offerIds } } : {})
    },
    orderBy: [{ updatedAt: 'desc' }]
  });

  const offers = offersDb as unknown as OfferAdminForm[];
  if (!offers.length) return [];

  const candidates = await prisma.product.findMany({
    where: { visible: true },
    orderBy: [{ updatedAt: 'desc' }],
    take: Math.max(24, Math.min(240, take * 6)),
    select: {
      id: true,
      name: true,
      price: true,
      sku: true,
      categoryId: true,
      tags: true,
      collection: true
    }
  });

  const now = new Date();
  const out: string[] = [];

  for (const p of candidates) {
    const line: CartLine = {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      unitPricePence: priceToPence(p.price),
      qty: 1,
      categoryId: p.categoryId,
      tags: Array.isArray(p.tags) ? p.tags : [],
      collection: p.collection
    };

    const res = evaluateOffers(offers, { now, lines: [line] });
    if (res.applied.length > 0) {
      out.push(p.id);
      if (out.length >= take) break;
    }
  }

  return out;
}

async function resolveSectionProductIds(cfg: Config): Promise<string[]> {
  const limit = Math.max(1, Math.min(48, Number(cfg.limit ?? 16)));

  const needsMinAge =
    cfg.source === 'MOST_CLICKED' || cfg.source === 'LEAST_CLICKED' || cfg.source === 'LEAST_SOLD';

  const minAgeDays = needsMinAge ? Math.max(0, Math.min(365, Number(cfg.minAgeDays ?? 14))) : 0;

  // exclude brand-new items from “least” lists
  const cutoff = minAgeDays > 0 ? new Date(Date.now() - minAgeDays * 86400000) : null;

  switch (cfg.source) {
    case 'BEST_SELLERS':
      return idsFrom({ visible: true }, { unitsSold: 'desc' }, limit);

    case 'NEW_ARRIVALS':
      return idsFrom({ visible: true }, { createdAt: 'desc' }, limit);

    case 'MOST_CLICKED':
      return idsFrom(
        { visible: true, ...(cutoff ? { createdAt: { lte: cutoff } } : {}) },
        { clicks: 'desc' },
        limit
      );

    case 'LEAST_CLICKED':
      return idsFrom(
        { visible: true, ...(cutoff ? { createdAt: { lte: cutoff } } : {}) },
        { clicks: 'asc' },
        limit
      );

    case 'LEAST_SOLD':
      return idsFrom(
        { visible: true, ...(cutoff ? { createdAt: { lte: cutoff } } : {}) },
        { unitsSold: 'asc' },
        limit
      );

    case 'CATEGORY':
      if (!cfg.categoryId) return [];
      return idsFrom({ visible: true, categoryId: cfg.categoryId }, { createdAt: 'desc' }, limit);

    case 'COLLECTION':
      if (!cfg.collection) return [];
      return idsFrom(
        { visible: true, collection: { contains: cfg.collection, mode: 'insensitive' } },
        { createdAt: 'desc' },
        limit
      );

    case 'MANUAL':
      return Array.isArray(cfg.productIds) ? cfg.productIds.slice(0, limit) : [];

    case 'DEALS': {
      const dealsMode: DealsMode = cfg.dealsMode ?? 'OFFER_ENGINE';

      if (dealsMode === 'RIBBON') {
        return idsFrom({ visible: true, ribbon: { not: null } }, { updatedAt: 'desc' }, limit);
      }

      if (dealsMode === 'DISCOUNT_FIELDS') {
        return idsFrom({ visible: true, discountValue: { gt: 0 } }, { updatedAt: 'desc' }, limit);
      }

      // ✅ OFFER_ENGINE: respects cfg.offerIds (if provided)
      return idsFromOfferEngine(cfg, limit);
    }

    case 'CAMPAIGN': {
      const k = cfg.campaignKey;
      if (!k) return [];
      return idsFrom({ visible: true, tags: { has: k } }, { updatedAt: 'desc' }, limit);
    }

    default:
      return [];
  }
}

export async function GET() {
  try {
    const now = new Date();

    const sections = await prisma.homeSection.findMany({
      where: { enabled: true },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
    });

    const active = sections
      .map((s) => {
        const cfg = getCfgFromJson(s.config);
        const mediaId = (s as unknown as { mediaId?: string | null }).mediaId ?? null;

        return {
          id: s.id,
          title: s.title,
          subtitle: s.subtitle ?? null,
          type: 'PRODUCT_CAROUSEL' as const,
          enabled: s.enabled,
          position: s.position,
          startAt: toIso(s.startAt),
          endAt: toIso(s.endAt),
          isLocked: s.isLocked,
          mediaId,
          config: cfg,
          createdAt: toIso(s.createdAt) ?? undefined,
          updatedAt: toIso(s.updatedAt) ?? undefined
        };
      })
      .filter((s) => nowInWindow(now, s.startAt ?? null, s.endAt ?? null));

    const resolved = await Promise.all(
      active.map(async (section) => {
        const productIds = section.config ? await resolveSectionProductIds(section.config) : [];
        return { section, productIds };
      })
    );

    const dto: HomeSectionsResolvedDTO = { sections: resolved };

    return NextResponse.json({ ok: true, data: dto }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('GET /api/site/home/sections failed:', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
