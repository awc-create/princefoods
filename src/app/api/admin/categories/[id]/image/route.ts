// src/app/api/admin/categories/[id]/products/route.ts
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

// GET /api/admin/categories/[id]/products
export async function GET(_req: Request, ctx: unknown) {
  try {
    // 👇 Cast the 2nd arg *inside* to avoid Next’s validator error
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const role = hasRole(session?.user) ? (session!.user.role ?? null) : null;
    if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const cat = await prisma.category.findUnique({
      where: { id: params.id },
      select: { id: true }
    });
    if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const products = await prisma.product.findMany({
      where: { categoryId: params.id },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        productImageUrl: true,
        visible: true
      }
    });

    return NextResponse.json(products);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

// PATCH /api/admin/categories/[id]/products
export async function PATCH(req: Request, ctx: unknown) {
  try {
    const { params } = ctx as { params: { id: string } };
    const session = await getServerSession(authOptions);
    const role = hasRole(session?.user) ? (session!.user.role ?? null) : null;
    if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const raw = (await req.json().catch(() => ({}))) as unknown;
    const body = (raw ?? {}) as { assignIds?: unknown; unassignIds?: unknown };

    const assignIds = Array.isArray(body.assignIds)
      ? body.assignIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];
    const unassignIds = Array.isArray(body.unassignIds)
      ? body.unassignIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
      : [];

    if (assignIds.length) {
      await prisma.product.updateMany({
        where: { id: { in: assignIds } },
        data: { categoryId: params.id }
      });
    }

    if (unassignIds.length) {
      await prisma.product.updateMany({
        where: { id: { in: unassignIds }, categoryId: params.id },
        data: { categoryId: null }
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
