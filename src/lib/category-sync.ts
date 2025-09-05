import { prisma } from '@/lib/prisma';
import slugify from '@/utils/slugify';

export interface CatLite {
  id: string;
  slug: string;
  parentId: string | null;
  name: string;
  isActive: boolean;
}

// Accept ; > / | as separators
export function splitCollectionPath(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;>\/|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Ensure a parent category exists (first segment), return CatLite.
 * Idempotent: reuses existing (by slug), re-enables/renames if needed.
 */
export async function ensureParentCategory(name: string): Promise<CatLite> {
  const parentSlug = slugify(name);
  // try exact parent (slug unique and parentId null)
  const hit = await prisma.category.findUnique({
    where: { slug: parentSlug },
    select: { id: true, slug: true, parentId: true, name: true, isActive: true }
  });

  if (hit && hit.parentId === null) {
    if (!hit.isActive || hit.name !== name) {
      const updated = await prisma.category.update({
        where: { id: hit.id },
        data: { isActive: true, name },
        select: { id: true, slug: true, parentId: true, name: true, isActive: true }
      });
      return updated;
    }
    return hit;
  }

  // create or upsert into a parent
  const created = await prisma.category.upsert({
    where: { slug: parentSlug },
    update: { parentId: null, isActive: true, name },
    create: { name, slug: parentSlug, parentId: null, isActive: true },
    select: { id: true, slug: true, parentId: true, name: true, isActive: true }
  });
  return created;
}

/**
 * Ensure a child category under parent (last segment), return CatLite.
 * Uses global-unique slug pattern: `${parent.slug}-${slugify(childName)}` (+numeric suffix if collision).
 */
export async function ensureChildCategory(childName: string, parent: CatLite): Promise<CatLite> {
  const childBase = slugify(childName);
  let childSlug = `${parent.slug}-${childBase}`;

  // Does that child already exist (exact slug)?
  let existing = await prisma.category.findUnique({
    where: { slug: childSlug },
    select: { id: true, slug: true, parentId: true, name: true, isActive: true }
  });

  if (existing && existing.parentId === parent.id) {
    if (!existing.isActive || existing.name !== childName) {
      existing = await prisma.category.update({
        where: { id: existing.id },
        data: { isActive: true, name: childName },
        select: { id: true, slug: true, parentId: true, name: true, isActive: true }
      });
    }
    return existing;
  }

  // Collision with a category under a different parent -> probe a free slug
  if (existing && existing.parentId !== parent.id) {
    let n = 2;
    while (
      await prisma.category.findUnique({
        where: { slug: `${parent.slug}-${childBase}-${n}` },
        select: { id: true }
      })
    ) {
      n++;
    }
    childSlug = `${parent.slug}-${childBase}-${n}`;
  }

  const created = await prisma.category.create({
    data: { name: childName, slug: childSlug, parentId: parent.id, isActive: true },
    select: { id: true, slug: true, parentId: true, name: true, isActive: true }
  });
  return created;
}

/**
 * Given a Product.collection, return the categoryId to assign:
 * - If 1 segment -> parent category
 * - If 2+ segments -> deepest (child) under the first segment as parent
 */
export async function resolveCategoryIdFromCollection(
  collection: string | null | undefined
): Promise<string | null> {
  const parts = splitCollectionPath(collection);
  if (!parts.length) return null;

  const parent = await ensureParentCategory(parts[0]);
  if (parts.length === 1) return parent.id;

  const childName = parts[parts.length - 1];
  const child = await ensureChildCategory(childName, parent);
  return child.id;
}
