import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

type BulkBody =
  | { action: 'hide' | 'show' | 'delete'; ids: string[] }
  | { action: 'hide' | 'show' | 'delete'; allMatching: true; search?: string | null };

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

function buildSearchWhere(q: string | null | undefined): Prisma.ProductWhereInput | undefined {
  if (!q || !q.trim()) return undefined; // undefined means "no filter" → all products
  const term = q.trim();
  return {
    OR: [
      { name: { contains: term, mode: 'insensitive' } },
      { sku: { contains: term, mode: 'insensitive' } },
      { brand: { contains: term, mode: 'insensitive' } },
      { collection: { contains: term, mode: 'insensitive' } },
      { description: { contains: term, mode: 'insensitive' } }
    ]
  };
}

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  let where: Prisma.ProductWhereInput = {};

  if ('allMatching' in body && body.allMatching) {
    // If search is empty, this becomes "all products"
    const w = buildSearchWhere(body.search);
    if (w) where = w;
  } else if ('ids' in body) {
    const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ message: 'No ids provided' }, { status: 400 });
    }
    where = { id: { in: ids } };
  } else {
    return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
  }

  try {
    if (body.action === 'hide') {
      const res = await prisma.product.updateMany({ where, data: { visible: false } });
      return NextResponse.json({ ok: true, updated: res.count });
    }
    if (body.action === 'show') {
      const res = await prisma.product.updateMany({ where, data: { visible: true } });
      return NextResponse.json({ ok: true, updated: res.count });
    }
    if (body.action === 'delete') {
      const res = await prisma.product.deleteMany({ where });
      return NextResponse.json({ ok: true, deleted: res.count });
    }
    return NextResponse.json({ message: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ message: 'Bulk action failed' }, { status: 500 });
  }
}
