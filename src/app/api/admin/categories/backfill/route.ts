// src/app/api/admin/categories/backfill/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';

// Simple slugify (or import from '@/utils/slugify' if you prefer)
function slugify(input: string) {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Accept ; > / | as separators
function splitCollectionPath(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[;>\/|]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function POST(req: Request) {
  try {
    // ---- AUTH (same as your other admin APIs)
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as 'HEAD' | 'STAFF' | 'VIEWER' | undefined;
    if (!role) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const dry = url.searchParams.get('dry') === '1';
    const debug = url.searchParams.get('debug') === '1';

    // ---- DIAGNOSTICS: make delegate presence explicit
    const hasProduct = !!(prisma as any)?.product?.findMany;
    const hasCategory = !!(prisma as any)?.category?.findMany;
    if (!hasProduct || !hasCategory) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Prisma client is missing required delegates. Ensure schema has Product & Category, then run `npx prisma generate`, restart dev server.',
          diagnostics: {
            hasProduct,
            hasCategory,
            prismaKeys: Object.keys(prisma as any),
          },
        },
        { status: 500 }
      );
    }

    // ---- LOAD products with a collection
    const products = await prisma.product.findMany({
      select: { id: true, collection: true, categoryId: true },
      where: { collection: { not: null } },
      orderBy: { createdAt: 'asc' },
    });

    // Optional debug snapshot
    const sampleCollections = products
      .map((p) => p.collection || '')
      .filter(Boolean)
      .slice(0, 5);

    // ---- Helpers that ALWAYS return a category
    async function ensureParent(name: string) {
      const parentSlug = slugify(name);
      const hit = await prisma.category.findUnique({
        where: { slug: parentSlug },
        select: { id: true, slug: true, parentId: true, name: true, isActive: true },
      });

      if (hit && hit.parentId === null) {
        if (!hit.isActive || hit.name !== name) {
          const upd = await prisma.category.update({
            where: { id: hit.id },
            data: { isActive: true, name },
            select: { id: true, slug: true, parentId: true, name: true, isActive: true },
          });
          return upd;
        }
        return hit;
      }

      // create or upsert
      const created = await prisma.category.upsert({
        where: { slug: parentSlug },
        update: { parentId: null, isActive: true, name },
        create: { name, slug: parentSlug, parentId: null, isActive: true },
        select: { id: true, slug: true, parentId: true, name: true, isActive: true },
      });
      return created;
    }

    async function ensureChild(childName: string, parent: { id: string; slug: string }) {
      const base = slugify(childName);
      let childSlug = `${parent.slug}-${base}`;

      let existing = await prisma.category.findUnique({
        where: { slug: childSlug },
        select: { id: true, slug: true, parentId: true, name: true, isActive: true },
      });

      if (existing && existing.parentId === parent.id) {
        if (!existing.isActive || existing.name !== childName) {
          existing = await prisma.category.update({
            where: { id: existing.id },
            data: { isActive: true, name: childName },
            select: { id: true, slug: true, parentId: true, name: true, isActive: true },
          });
        }
        return existing;
      }

      // slug collision under different parent -> suffix
      if (existing && existing.parentId !== parent.id) {
        let n = 2;
        while (
          await prisma.category.findUnique({
            where: { slug: `${parent.slug}-${base}-${n}` },
            select: { id: true },
          })
        ) {
          n++;
        }
        childSlug = `${parent.slug}-${base}-${n}`;
      }

      const created = await prisma.category.create({
        data: { name: childName, slug: childSlug, parentId: parent.id, isActive: true },
        select: { id: true, slug: true, parentId: true, name: true, isActive: true },
      });
      return created;
    }

    let productsUpdated = 0;
    let parentsTouched = new Set<string>();
    let childrenTouched = new Set<string>();
    const updates: Array<{ id: string; categoryId: string }> = [];

    for (const p of products) {
      const parts = splitCollectionPath(p.collection);
      if (!parts.length) continue;

      const parentName = parts[0];
      const parent = await ensureParent(parentName);
      parentsTouched.add(parent.slug);

      let targetId = parent.id;
      if (parts.length > 1) {
        const childName = parts[parts.length - 1];
        const child = await ensureChild(childName, { id: parent.id, slug: parent.slug });
        childrenTouched.add(child.slug);
        targetId = child.id;
      }

      if (p.categoryId !== targetId) {
        updates.push({ id: p.id, categoryId: targetId });
      }
    }

    if (!dry && updates.length) {
      const chunk = 100;
      for (let i = 0; i < updates.length; i += chunk) {
        const slice = updates.slice(i, i + chunk);
        await prisma.$transaction(
          slice.map((u) =>
            prisma.product.update({
              where: { id: u.id },
              data: { categoryId: u.categoryId },
              select: { id: true },
            })
          )
        );
        productsUpdated += slice.length;
      }
    } else {
      productsUpdated = updates.length;
    }

    return NextResponse.json({
      ok: true,
      dryRun: dry,
      scannedProducts: products.length,
      productsUpdated,
      parentsTouched: parentsTouched.size,
      childrenTouched: childrenTouched.size,
      ...(debug
        ? {
            diagnostics: {
              hasProduct,
              hasCategory,
              sampleCollections,
            },
          }
        : {}),
    });
  } catch (err: any) {
    const msg = err?.message || String(err) || 'Unknown error in backfill';
    console.error('[categories/backfill] ERROR:', err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
