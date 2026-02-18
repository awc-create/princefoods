// src/app/api/admin/options/categories/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

export interface PickerOption {
  id: string; // category "id" = the category string
  label: string;
  meta?: string;
}

function childCategory(full?: string | null) {
  if (!full) return '';
  const parts = full
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function safeLower(s: string | null | undefined) {
  return (s ?? '').trim().toLowerCase();
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;

  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = safeLower(url.searchParams.get('q'));
  const takeRaw = Number(url.searchParams.get('take') ?? '300');
  const take = Math.max(50, Math.min(2000, Number.isFinite(takeRaw) ? Math.trunc(takeRaw) : 300));

  // Pull collections (light query) then dedupe in memory
  const rows = await prisma.product.findMany({
    where: { collection: { not: null } },
    select: { collection: true }
  });

  const map = new Map<string, { label: string; count: number }>();

  for (const r of rows) {
    const c = childCategory(r.collection);
    if (!c) continue;
    const key = c.trim();
    if (!key) continue;
    const hit = map.get(key) ?? { label: key, count: 0 };
    hit.count += 1;
    map.set(key, hit);
  }

  let arr = Array.from(map.entries()).map(([name, v]) => ({
    id: name,
    label: v.label,
    meta: `${v.count} products`
  }));

  if (q) {
    arr = arr.filter((x) => x.label.toLowerCase().includes(q));
  }

  arr.sort((a, b) => a.label.localeCompare(b.label));
  arr = arr.slice(0, take);

  return NextResponse.json({ options: arr });
}
