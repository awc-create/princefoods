import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json([], { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') || 200)));

  const where = q
    ? { name: { contains: q, mode: 'insensitive' as const } }
    : undefined;

  const items = await prisma.product.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json(items);
}
