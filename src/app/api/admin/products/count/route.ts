// src/app/api/admin/products/count/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function buildSearchWhere(q: string | null) {
  if (!q || !q.trim()) return undefined;
  const term = q.trim();
  return {
    OR: [
      { name:        { contains: term, mode: 'insensitive' as const } },
      { sku:         { contains: term, mode: 'insensitive' as const } },
      { brand:       { contains: term, mode: 'insensitive' as const } },
      { collection:  { contains: term, mode: 'insensitive' as const } },
      { description: { contains: term, mode: 'insensitive' as const } },
    ],
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('search');

  const where = buildSearchWhere(q);
  const count = await prisma.product.count({ where });
  return NextResponse.json({ count });
}
