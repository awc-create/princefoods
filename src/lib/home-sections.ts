// src/lib/home-sections.ts
import { prisma } from '@/lib/prisma';
import type { DealsMode, HomeSectionProductCarouselConfig } from '@/types/homeSections';

interface ProductRow {
  id: string;
  name: string;
  price: number | null;
  productImageUrl: string | null;

  sku: string | null;
  categoryId: string | null;
  tags: string[];
  collection: string | null;
}

type DealsSelectionMode = 'ALL_ACTIVE' | 'SELECTED';

interface ExtractedOfferTargets {
  directProductIds: string[];
  includesAllProducts: boolean;
}

interface OfferLite {
  id: string;
  name: string;
  status: string;
  startsAt: Date | null;
  endsAt: Date | null;
  payload: unknown;
}

const takeSelect = (limit: number) => ({
  take: limit,
  where: { visible: true },
  select: {
    id: true,
    name: true,
    price: true,
    productImageUrl: true,

    sku: true,
    categoryId: true,
    tags: true,
    collection: true
  } as const
});

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function offerIdsFromCfg(cfg: HomeSectionProductCarouselConfig): string[] {
  const raw = cfg.offerIds;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean);
}

function dealsSelectionModeFromCfg(cfg: HomeSectionProductCarouselConfig): DealsSelectionMode {
  return cfg.dealsSelectionMode === 'SELECTED' ? 'SELECTED' : 'ALL_ACTIVE';
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object';
}

function readStringArray(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function extractPoolTargets(pool: unknown): ExtractedOfferTargets {
  if (!Array.isArray(pool)) {
    return {
      directProductIds: [],
      includesAllProducts: false
    };
  }

  const ids = new Set<string>();
  let includesAllProducts = false;

  for (const entry of pool) {
    if (!isRecord(entry)) continue;

    const type = typeof entry.type === 'string' ? entry.type : '';

    if (type === 'PRODUCT_IDS') {
      for (const id of readStringArray(entry.ids)) {
        ids.add(id);
      }
    }

    if (type === 'ALL_PRODUCTS') {
      includesAllProducts = true;
    }
  }

  return {
    directProductIds: [...ids],
    includesAllProducts
  };
}

function extractOfferTargets(payload: unknown): ExtractedOfferTargets {
  if (!isRecord(payload)) {
    return {
      directProductIds: [],
      includesAllProducts: false
    };
  }

  const data = isRecord(payload.data) ? payload.data : null;
  if (!data) {
    return {
      directProductIds: [],
      includesAllProducts: false
    };
  }

  const buy = extractPoolTargets(data.buyPool);
  const get = extractPoolTargets(data.getPool);

  return {
    directProductIds: [...new Set([...buy.directProductIds, ...get.directProductIds])],
    includesAllProducts: buy.includesAllProducts || get.includesAllProducts
  };
}

function isOfferLive(offer: OfferLite, now: Date): boolean {
  if (offer.status !== 'ACTIVE') return false;
  if (offer.startsAt && offer.startsAt > now) return false;
  if (offer.endsAt && offer.endsAt < now) return false;
  return true;
}

async function getRelevantDealsOffers(cfg: HomeSectionProductCarouselConfig): Promise<OfferLite[]> {
  const selectionMode = dealsSelectionModeFromCfg(cfg);
  const selectedIds = offerIdsFromCfg(cfg);
  const now = new Date();

  const offers = await prisma.offer.findMany({
    where:
      selectionMode === 'SELECTED'
        ? {
            id: { in: selectedIds.length ? selectedIds : ['__none__'] }
          }
        : {
            status: 'ACTIVE'
          },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      name: true,
      status: true,
      startsAt: true,
      endsAt: true,
      payload: true
    }
  });

  return offers.filter((offer) => isOfferLive(offer, now));
}

async function resolveDealsOfferEngineProducts(
  cfg: HomeSectionProductCarouselConfig,
  limit: number
): Promise<ProductRow[]> {
  const offers = await getRelevantDealsOffers(cfg);
  if (!offers.length) return [];

  const directIdSet = new Set<string>();
  let includesAllProducts = false;

  for (const offer of offers) {
    const targets = extractOfferTargets(offer.payload);

    for (const id of targets.directProductIds) {
      directIdSet.add(id);
    }

    if (targets.includesAllProducts) {
      includesAllProducts = true;
    }
  }

  const directIds = [...directIdSet];

  const directProducts =
    directIds.length > 0
      ? await prisma.product.findMany({
          where: {
            visible: true,
            id: { in: directIds }
          },
          select: {
            id: true,
            name: true,
            price: true,
            productImageUrl: true,
            sku: true,
            categoryId: true,
            tags: true,
            collection: true
          }
        })
      : [];

  // Keep same order as extracted ids where possible
  const directProductMap = new Map(directProducts.map((p) => [p.id, p]));
  const orderedDirectProducts = directIds
    .map((id) => directProductMap.get(id))
    .filter((p): p is ProductRow => !!p);

  if (orderedDirectProducts.length >= limit) {
    return orderedDirectProducts.slice(0, limit);
  }

  if (!includesAllProducts) {
    return orderedDirectProducts.slice(0, limit);
  }

  const remaining = limit - orderedDirectProducts.length;
  const excludeIds = orderedDirectProducts.map((p) => p.id);

  const fillerProducts = await prisma.product.findMany({
    take: remaining,
    where: {
      visible: true,
      id: {
        notIn: excludeIds.length ? excludeIds : ['__none__']
      }
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      price: true,
      productImageUrl: true,
      sku: true,
      categoryId: true,
      tags: true,
      collection: true
    }
  });

  return [...orderedDirectProducts, ...fillerProducts].slice(0, limit);
}

export async function productsForSection(
  cfg: HomeSectionProductCarouselConfig
): Promise<ProductRow[]> {
  const limit = clamp(Number(cfg.limit ?? 16), 1, 48);
  const base = takeSelect(limit);

  switch (cfg.source) {
    case 'BEST_SELLERS':
      return prisma.product.findMany({
        ...base,
        orderBy: [{ unitsSold: 'desc' }, { createdAt: 'desc' }]
      });

    case 'NEW_ARRIVALS':
      return prisma.product.findMany({ ...base, orderBy: [{ createdAt: 'desc' }] });

    case 'MOST_CLICKED':
      return prisma.product.findMany({
        ...base,
        orderBy: [{ clicks: 'desc' }, { createdAt: 'desc' }]
      });

    case 'LEAST_CLICKED': {
      const days = clamp(Number(cfg.minAgeDays ?? 14), 0, 365);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return prisma.product.findMany({
        ...base,
        where: { ...base.where, createdAt: { lte: cutoff } },
        orderBy: [{ clicks: 'asc' }, { createdAt: 'desc' }]
      });
    }

    case 'LEAST_SOLD': {
      const days = clamp(Number(cfg.minAgeDays ?? 14), 0, 365);
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return prisma.product.findMany({
        ...base,
        where: { ...base.where, createdAt: { lte: cutoff } },
        orderBy: [{ unitsSold: 'asc' }, { createdAt: 'desc' }]
      });
    }

    case 'CATEGORY':
      return prisma.product.findMany({
        ...base,
        where: { ...base.where, categoryId: cfg.categoryId ?? undefined },
        orderBy: [{ createdAt: 'desc' }]
      });

    case 'COLLECTION':
      return prisma.product.findMany({
        ...base,
        where: {
          ...base.where,
          collection: cfg.collection ? { contains: cfg.collection, mode: 'insensitive' } : undefined
        },
        orderBy: [{ createdAt: 'desc' }]
      });

    case 'MANUAL':
      return prisma.product.findMany({
        ...base,
        where: { ...base.where, id: { in: cfg.productIds?.length ? cfg.productIds : ['__none__'] } }
      });

    case 'CAMPAIGN':
      return prisma.product.findMany({
        ...base,
        where: { ...base.where, tags: cfg.campaignKey ? { has: cfg.campaignKey } : undefined },
        orderBy: [{ createdAt: 'desc' }]
      });

    case 'DEALS': {
      const dealsMode: DealsMode = cfg.dealsMode ?? 'OFFER_ENGINE';

      if (dealsMode === 'DISCOUNT_FIELDS') {
        return prisma.product.findMany({
          ...base,
          where: { ...base.where, discountValue: { gt: 0 } },
          orderBy: [{ updatedAt: 'desc' }]
        });
      }

      if (dealsMode === 'RIBBON') {
        return prisma.product.findMany({
          ...base,
          where: { ...base.where, ribbon: { not: null } },
          orderBy: [{ updatedAt: 'desc' }]
        });
      }

      return resolveDealsOfferEngineProducts(cfg, limit);
    }

    default:
      return prisma.product.findMany({ ...base, orderBy: [{ createdAt: 'desc' }] });
  }
}
