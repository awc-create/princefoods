import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
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
  if (!role) return NextResponse.json([], { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? 200)));

  const where = q ? { name: { contains: q, mode: 'insensitive' as const } } : undefined;

  const items = await prisma.product.findMany({
    where,
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  return NextResponse.json(items);
}
