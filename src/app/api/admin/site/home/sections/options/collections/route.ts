// src/app/api/admin/site/home/sections/options/collections/route.ts
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

function splitCollections(raw?: string | null) {
  return (raw ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

function prettyCollectionPath(full: string) {
  const parts = full
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return full;
  if (parts.length === 1) return parts[0];
  return `${parts[0]} → ${parts[parts.length - 1]}`;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();

    // Pull many products and extract unique collections
    const rows = await prisma.product.findMany({
      where: { collection: { not: null } },
      select: { collection: true },
      take: 2000
    });

    const all = new Set<string>();
    for (const r of rows) {
      for (const c of splitCollections(r.collection)) {
        all.add(c);
      }
    }

    let list = Array.from(all);
    if (q) list = list.filter((x) => x.toLowerCase().includes(q));

    list.sort((a, b) => a.localeCompare(b));

    const options = list.slice(0, 300).map((c) => ({
      id: c,
      label: prettyCollectionPath(c),
      meta: c.includes(';') ? c : undefined
    }));

    return NextResponse.json({ options });
  } catch (e) {
    return authFail(e);
  }
}
