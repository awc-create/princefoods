// src/app/api/admin/categories/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role | null };

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

const json = <T>(b: T, init?: ResponseInit) => NextResponse.json(b, init);

const slugify = (s: string) =>
  (s || '')
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

// GET: list parent categories (no auth; safe JSON)
export async function GET() {
  try {
    try {
      const items = await prisma.category.findMany({
        where: { parentId: null },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          slug: true,
          position: true,
          isActive: true,
          imageUrl: true,
          _count: { select: { children: true } },
        },
      });
      return json(items);
    } catch {
      const items = await prisma.category.findMany({
        where: { parentId: null },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          _count: { select: { children: true } },
        },
      });
      const withDefaults = items.map((c) => ({ position: 0, imageUrl: null as string | null, ...c }));
      return json(withDefaults);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'GET categories failed';
    return json({ ok: false, error: message }, { status: 500 });
  }
}

// POST: create parent or child (auth required; safe JSON)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user) ? (session!.user.role ?? undefined) : undefined;
  if (!role) return json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      parentId?: string;
      imageUrl?: string | null;
    };
    const { name, parentId, imageUrl } = body;
    if (!name?.trim()) return json({ message: 'Name required' }, { status: 400 });

    const upsertCat = async (slug: string, pid: string | null) => {
      try {
        const cat = await prisma.category.upsert({
          where: { slug },
          update: { name, isActive: true, parentId: pid, imageUrl: imageUrl ?? null },
          create: { name, slug, isActive: true, parentId: pid, imageUrl: imageUrl ?? null },
          select: { id: true },
        });
        return cat.id;
      } catch {
        const cat = await prisma.category.upsert({
          where: { slug },
          update: { name, isActive: true, parentId: pid },
          create: { name, slug, isActive: true, parentId: pid },
          select: { id: true },
        });
        return cat.id;
      }
    };

    if (!parentId) {
      const slug = slugify(name);
      const id = await upsertCat(slug, null);
      return json({ ok: true, id });
    }

    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true, slug: true } });
    if (!parent) return json({ message: 'Parent not found' }, { status: 404 });

    const base = slugify(name);
    let slug = `${parent.slug}-${base}`;
    const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true, parentId: true } });
    if (clash && clash.parentId !== parent.id) {
      let n = 2;
       
      while (await prisma.category.findUnique({ where: { slug: `${parent.slug}-${base}-${n}` }, select: { id: true } }))
        n++;
      slug = `${parent.slug}-${base}-${n}`;
    }

    const id = await upsertCat(slug, parent.id);
    return json({ ok: true, id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'POST categories failed';
    return json({ ok: false, error: message }, { status: 500 });
  }
}
