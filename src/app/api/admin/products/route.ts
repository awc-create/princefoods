import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // ---- MODE A: minimal list for pickers (?fields=id,name&limit=200)
  const fields = (searchParams.get('fields') || '').split(',').map(s => s.trim()).filter(Boolean);
  const limitParam = searchParams.get('limit');
  if (fields.length || limitParam) {
    const limit = Math.min(parseInt(limitParam || '200', 10) || 200, 1000);
    const select: Record<string, true> = {};
    if (fields.includes('id')) select.id = true;
    if (fields.includes('name')) select.name = true;
    if (!Object.keys(select).length) { select.id = true; select.name = true; }

    const items = await prisma.product.findMany({
      select,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return NextResponse.json(items);
  }

  // ---- MODE B: paged search (your original)
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = 20;
  const search = (searchParams.get('search') || '').trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { sku: { contains: search, mode: 'insensitive' as const } },
          { brand: { contains: search, mode: 'insensitive' as const } },
          { collection: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [totalMatches, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, sku: true, price: true, inventory: true, collection: true,
        productImageUrl: true, visible: true, createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  return NextResponse.json({ items, totalPages, totalMatches, pageSize });
}
