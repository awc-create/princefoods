// src/lib/catalog.ts
import { prisma } from '@/lib/prisma';

const base = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';

const abs = (u?: string | null) => {
  if (!u) return `${base}/assets/product-placeholder.jpg`;
  const s = u.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `${base.replace(/\/+$/, '')}/${s.replace(/^\/+/, '')}`;
};

export interface CategoryTeaser {
  title: string;
  href: string;
  image: string;
}
export interface ProductTeaser {
  id: string;
  title: string;
  href: string;
  image: string;
  price?: number | null;
}

export async function getFeaturedCategories(limit = 6): Promise<CategoryTeaser[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: limit,
    select: { name: true, slug: true, imageUrl: true }
  });

  return rows.map((c) => ({
    title: c.name,
    href: `/c/${c.slug}`,
    image: abs(c.imageUrl) || `${base}/assets/category-placeholder.jpg`
  }));
}

/** Placeholder – swap to your own sales/popularity logic later. */
export async function getBestSellers(limit = 6): Promise<ProductTeaser[]> {
  // Simple stand-in: newest visible products
  const rows = await prisma.product.findMany({
    where: { visible: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, name: true, productImageUrl: true, price: true }
  });

  return rows.map((p) => ({
    id: p.id,
    title: p.name,
    href: `/p/${p.id}`,
    image: abs(p.productImageUrl),
    price: p.price ?? null
  }));
}
