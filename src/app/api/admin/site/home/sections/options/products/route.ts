// src/app/api/admin/site/home/sections/options/products/route.ts
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

function prettyCollection(full?: string | null) {
  const parts = (full ?? '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} → ${parts[parts.length - 1]}`;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();

    const products = await prisma.product.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { sku: { contains: q, mode: 'insensitive' } }
            ]
          }
        : undefined,
      orderBy: [{ name: 'asc' }],
      take: 200,
      select: {
        id: true,
        name: true,
        sku: true,
        collection: true
      }
    });

    const options = products.map((p) => {
      const bits: string[] = [];
      if (p.sku) bits.push(`SKU: ${p.sku}`);
      const col = prettyCollection(p.collection);
      if (col) bits.push(col);

      return {
        id: p.id,
        label: p.name ?? 'Unnamed product',
        meta: bits.length ? bits.join(' • ') : undefined
      };
    });

    return NextResponse.json({ options });
  } catch (e) {
    return authFail(e);
  }
}
