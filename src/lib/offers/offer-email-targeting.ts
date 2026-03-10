import type { OfferPayload, OfferTargetRule } from '@/types/offers';
import type { PrismaClient } from '@prisma/client';

const SITE_BASE = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  'https://www.prince-foods.com'
).replace(/\/$/, '');

const SHOP_ALL_PATH = '/shop';
const CATEGORY_PATH = (slug: string) => `/shop/category/${slug}`;
const PRODUCT_PATH = (id: string) => `/product/${id}`;

export interface OfferEmailProductCard {
  id: string;
  name: string;
  href: string;
  imageUrl: string | null;
  pricePence: number | null;
  categoryName?: string | null;
}

export interface OfferEmailPresentation {
  ctaLabel: string;
  ctaHref: string;
  sectionTitle: string;
  products: OfferEmailProductCard[];
}

function normalizePricePence(price: number | null | undefined) {
  return typeof price === 'number' && Number.isFinite(price) ? Math.round(price * 100) : null;
}

function shopAllUrl() {
  return `${SITE_BASE}${SHOP_ALL_PATH}`;
}

function productUrl(id: string) {
  return `${SITE_BASE}${PRODUCT_PATH(id)}`;
}

function categoryUrl(slug: string | null | undefined) {
  return slug ? `${SITE_BASE}${CATEGORY_PATH(slug)}` : shopAllUrl();
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isTargetRuleArray(x: unknown): x is OfferTargetRule[] {
  return Array.isArray(x);
}

export function isOfferPayload(x: unknown): x is OfferPayload {
  if (!isRecord(x)) return false;
  if (typeof x.kind !== 'string') return false;
  if (!('data' in x)) return false;
  return true;
}

function extractPrimaryPool(payload: OfferPayload): OfferTargetRule[] {
  if (payload.kind === 'BOGOF') {
    return isTargetRuleArray(payload.data.buyPool)
      ? payload.data.buyPool
      : [{ type: 'ALL_PRODUCTS' }];
  }

  if (payload.kind === 'X_FOR_Y') {
    return isTargetRuleArray(payload.data.pool) ? payload.data.pool : [{ type: 'ALL_PRODUCTS' }];
  }

  if (payload.kind === 'X_FOR_FIXED_PRICE') {
    return isTargetRuleArray(payload.data.pool) ? payload.data.pool : [{ type: 'ALL_PRODUCTS' }];
  }

  if (payload.kind === 'PERCENT_OFF') {
    return isTargetRuleArray(payload.data.pool) ? payload.data.pool : [{ type: 'ALL_PRODUCTS' }];
  }

  if (payload.kind === 'AMOUNT_OFF') {
    return isTargetRuleArray(payload.data.pool) ? payload.data.pool : [{ type: 'ALL_PRODUCTS' }];
  }

  if (payload.kind === 'SPEND_X_GET_Y') {
    return [{ type: 'ALL_PRODUCTS' }];
  }

  return [{ type: 'ALL_PRODUCTS' }];
}

function pickCategoryIds(pool: OfferTargetRule[]): string[] {
  const ids = new Set<string>();

  for (const rule of pool) {
    if (rule.type === 'CATEGORY_IDS' && Array.isArray(rule.ids)) {
      for (const id of rule.ids) {
        if (typeof id === 'string' && id.trim()) ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

function pickProductIds(pool: OfferTargetRule[]): string[] {
  const ids = new Set<string>();

  for (const rule of pool) {
    if (rule.type === 'PRODUCT_IDS' && Array.isArray(rule.ids)) {
      for (const id of rule.ids) {
        if (typeof id === 'string' && id.trim()) ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

function hasAllProducts(pool: OfferTargetRule[]) {
  return pool.some((r) => r.type === 'ALL_PRODUCTS');
}

function looksFrozenCategory(category: { name?: string | null; slug?: string | null }) {
  const blob = `${category.name ?? ''} ${category.slug ?? ''}`.toLowerCase();
  return blob.includes('frozen');
}

export async function buildOfferEmailPresentation(
  prisma: PrismaClient,
  payload: OfferPayload
): Promise<OfferEmailPresentation> {
  const pool = extractPrimaryPool(payload);

  if (hasAllProducts(pool)) {
    const products = await prisma.product.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        price: true,
        productImageUrl: true,
        category: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    return {
      ctaLabel: 'Shop all products',
      ctaHref: shopAllUrl(),
      sectionTitle: 'Featured products',
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        href: productUrl(p.id),
        imageUrl: p.productImageUrl ?? null,
        pricePence: normalizePricePence(p.price),
        categoryName: p.category?.name ?? null
      }))
    };
  }

  const targetProductIds = pickProductIds(pool);
  if (targetProductIds.length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: targetProductIds } },
      select: {
        id: true,
        name: true,
        price: true,
        productImageUrl: true,
        category: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    });

    const byId = new Map(products.map((p) => [p.id, p]));
    const ordered = targetProductIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p);

    return {
      ctaLabel: 'Shop this offer',
      ctaHref: ordered[0] ? productUrl(ordered[0].id) : shopAllUrl(),
      sectionTitle: 'Products in this offer',
      products: ordered.map((p) => ({
        id: p.id,
        name: p.name,
        href: productUrl(p.id),
        imageUrl: p.productImageUrl ?? null,
        pricePence: normalizePricePence(p.price),
        categoryName: p.category?.name ?? null
      }))
    };
  }

  const targetCategoryIds = pickCategoryIds(pool);
  if (targetCategoryIds.length > 0) {
    const categories = await prisma.category.findMany({
      where: { id: { in: targetCategoryIds } },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });

    const products = await prisma.product.findMany({
      where: {
        categoryId: { in: targetCategoryIds }
      },
      take: 12,
      select: {
        id: true,
        name: true,
        price: true,
        productImageUrl: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (categories.length === 1) {
      const cat = categories[0];

      return {
        ctaLabel: looksFrozenCategory(cat) ? 'Shop frozen products' : 'Shop this category',
        ctaHref: categoryUrl(cat.slug),
        sectionTitle: cat.name ?? 'Products in this category',
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          href: productUrl(p.id),
          imageUrl: p.productImageUrl ?? null,
          pricePence: normalizePricePence(p.price),
          categoryName: p.category?.name ?? null
        }))
      };
    }

    return {
      ctaLabel: 'Shop offer categories',
      ctaHref: shopAllUrl(),
      sectionTitle: 'Products in this offer',
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        href: productUrl(p.id),
        imageUrl: p.productImageUrl ?? null,
        pricePence: normalizePricePence(p.price),
        categoryName: p.category?.name ?? null
      }))
    };
  }

  return {
    ctaLabel: 'Shop now',
    ctaHref: shopAllUrl(),
    sectionTitle: 'Products in this offer',
    products: []
  };
}
