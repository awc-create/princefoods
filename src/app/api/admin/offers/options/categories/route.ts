// src/app/api/admin/offers/options/categories/route.ts
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/route-ctx';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authFail(e: unknown) {
  const msg = e instanceof Error ? e.message : 'UNAUTHENTICATED';
  const status = msg === 'FORBIDDEN' ? 403 : 401;
  return NextResponse.json({ error: msg }, { status });
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();

    // Pull parents too so we can build Parent → Child labels.
    // Assumes Category has parentId relation named "parent". If yours differs, rename `parent`.
    const categories = await prisma.category.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q, mode: 'insensitive' } },
              // if searching child and parent names helps:
              { parent: { name: { contains: q, mode: 'insensitive' } } }
            ]
          }
        : undefined,
      orderBy: [{ name: 'asc' }],
      take: 300,
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        parent: { select: { name: true, slug: true } }
      }
    });

    const options = categories.map((c) => {
      const parentName = c.parent?.name?.trim();
      const name = c.name?.trim() || 'Unnamed category';

      const label = parentName ? `${parentName} → ${name}` : name;
      const meta = c.slug ? `/${c.slug}` : c.parent?.slug ? `/${c.parent.slug}` : undefined;

      return {
        id: c.id,
        label,
        meta
      };
    });

    return NextResponse.json({ options });
  } catch (e) {
    return authFail(e);
  }
}
