import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function isAdmin(role?: string | null) {
  return role === 'HEAD' || role === 'STAFF';
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role ?? null;

  if (!session?.user || !isAdmin(role)) return bad('Unauthorized', 401);

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      take: 2000,
      select: { id: true, name: true, slug: true }
    }),
    prisma.product.findMany({
      // If you have "visible" on Product and want only visible:
      // where: { visible: true },
      orderBy: [{ name: 'asc' }],
      take: 8000,
      select: { id: true, name: true, sku: true }
    })
  ]);

  return NextResponse.json({
    ok: true,
    categories,
    products
  });
}
