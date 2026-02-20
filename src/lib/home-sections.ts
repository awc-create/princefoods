// src/lib/home-sections.ts
import type { CartLine, OfferAdminForm } from '@/lib/offers-engine';
import { evaluateOffers } from '@/lib/offers-engine';
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

/**
 * If Product.price is stored in pounds (e.g. 1.99), convert to pence for offers engine.
 * If your DB stores pence already, change this to: return clampInt(price, 0, 999999);
 */
function priceToPence(price: number | null): number {
  const n = Number(price ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function toCartLine(p: ProductRow): CartLine {
  return {
    productId: p.id,
    sku: p.sku,
    name: p.name,
    unitPricePence: priceToPence(p.price),
    qty: 1,
    categoryId: p.categoryId,
    tags: Array.isArray(p.tags) ? p.tags : [],
    collection: p.collection
  };
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

      // ✅ discount fields mode
      if (dealsMode === 'DISCOUNT_FIELDS') {
        return prisma.product.findMany({
          ...base,
          where: { ...base.where, discountValue: { gt: 0 } },
          orderBy: [{ updatedAt: 'desc' }]
        });
      }

      // ✅ ribbon mode
      if (dealsMode === 'RIBBON') {
        return prisma.product.findMany({
          ...base,
          where: { ...base.where, ribbon: { not: null } },
          orderBy: [{ updatedAt: 'desc' }]
        });
      }

      // ✅ offer engine mode (this is where cfg.offerIds matters)
      const restrictOfferIds = offerIdsFromCfg(cfg);

      const offersDb = await prisma.offer.findMany({
        where: {
          status: 'ACTIVE',
          ...(restrictOfferIds.length ? { id: { in: restrictOfferIds } } : {})
        },
        orderBy: [{ updatedAt: 'desc' }]
      });

      const offers = offersDb as unknown as OfferAdminForm[];
      if (!offers.length) return [];

      // Candidate pool bigger than limit, then filter down by engine
      const candidates = await prisma.product.findMany({
        ...takeSelect(clamp(limit * 6, 24, 240)),
        orderBy: [{ updatedAt: 'desc' }]
      });

      const now = new Date();
      const matches: ProductRow[] = [];

      for (const p of candidates) {
        const line = toCartLine(p);
        const res = evaluateOffers(offers, { now, lines: [line] });

        if (res.applied.length > 0) {
          matches.push(p);
          if (matches.length >= limit) break;
        }
      }

      return matches;
    }

    default:
      return prisma.product.findMany({ ...base, orderBy: [{ createdAt: 'desc' }] });
  }
}
