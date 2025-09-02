import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

const HEADERS = ['Pic', 'Name', 'SKU', 'Price', 'Inventory', 'Collection'] as const;

function esc(val: any) {
  if (val == null) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function childCategory(full?: string | null) {
  if (!full) return '';
  const parts = full.split(';').map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD' | 'STAFF' | 'VIEWER' | undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get('ids');
  const ids = idsParam ? idsParam.split(',').map(s => s.trim()).filter(Boolean) : null;

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
    const row = {
      Pic: p.productImageUrl || '',
      Name: p.name ?? '',
      SKU: p.sku ?? '',
      Price: p.price ?? '',
      Inventory: p.inventory ?? '',
      Collection: childCategory(p.collection),
    };
    lines.push(HEADERS.map(h => esc((row as any)[h])).join(','));
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
