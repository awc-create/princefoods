// src/app/api/admin/products/export/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role | null };
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

const HEADERS = ['Pic', 'Name', 'SKU', 'Price', 'Inventory', 'Collection'] as const;
type CsvHeader = typeof HEADERS[number];

function esc(val: unknown): string {
  if (val == null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function childCategory(full?: string | null) {
  if (!full) return '';
  const parts = full.split(';').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user) ? (session!.user.role ?? undefined) : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : null;

  const items = await prisma.product.findMany({
    where: ids ? { id: { in: ids } } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      name: true,
      sku: true,
      price: true,
      inventory: true,
      collection: true,
      productImageUrl: true,
    },
  });

  const lines: string[] = [];
  lines.push(HEADERS.join(','));

  for (const p of items) {
    const row: Record<CsvHeader, string> = {
      Pic: p.productImageUrl || '',
      Name: p.name ?? '',
      SKU: p.sku ?? '',
      Price: p.price != null ? String(p.price) : '',
      Inventory: p.inventory ?? '',
      Collection: childCategory(p.collection),
    };
    lines.push(HEADERS.map((h) => esc(row[h])).join(','));
  }

  const csv = lines.join('\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products-list-export.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
