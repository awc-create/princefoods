import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUser {
  role?: Role | null;
}

const hasRole = (u: unknown): u is SessionUser =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);

  // ---- MODE A: minimal list for pickers (?fields=id,name&limit=200)
  const fields = (searchParams.get('fields') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const limitParam = searchParams.get('limit');

  if (fields.length > 0 || limitParam) {
    const limitRaw = parseInt(limitParam ?? '200', 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;

    // Build a typed select
    const select: { id?: true; name?: true } = {};
    if (fields.includes('id')) select.id = true;
    if (fields.includes('name')) select.name = true;
    if (!select.id && !select.name) {
      select.id = true;
      select.name = true;
    }

    const items = await prisma.product.findMany({
      select,
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return NextResponse.json(items);
  }

  // ---- MODE B: paged search
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const pageSize = 20;
  const search = (searchParams.get('search') ?? '').trim();

  // ✅ collections filter (comma-separated exact matches)
  const collectionsParam = (searchParams.get('collections') ?? '').trim();
  const collections = collectionsParam
    ? collectionsParam
        .split(',')
        .map((s) => decodeURIComponent(s).trim())
        .filter(Boolean)
    : [];

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { brand: { contains: search, mode: 'insensitive' as const } },
            { collection: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      : {}),
    ...(collections.length ? { collection: { in: collections } } : {})
  };

  const [totalMatches, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        inventory: true,
        collection: true,
        productImageUrl: true,
        visible: true,
        createdAt: true
      }
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalMatches / pageSize));
  return NextResponse.json({ items, totalPages, totalMatches, pageSize });
}
