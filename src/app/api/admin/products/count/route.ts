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
  const search = (searchParams.get('search') ?? '').trim();

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

  const count = await prisma.product.count({ where });
  return NextResponse.json({ count });
}
