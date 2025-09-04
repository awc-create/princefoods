// src/app/api/admin/categories/[id]/products/route.ts
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role | null };

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

async function jsonOrEmpty<T = unknown>(req: Request): Promise<T | object> {
  try {
    return (await req.json()) as T;
  } catch {
    return {};
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = hasRole(session?.user) ? (session!.user.role ?? undefined) : undefined;
  if (!role) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const cat = await prisma.category.findUnique({
    where: { id: params.id },
    select: { id: true },
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
      visible: true,
    },
  });

  return NextResponse.json(products);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = hasRole(session?.user) ? (session!.user.role ?? undefined) : undefined;
  if (!role) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await jsonOrEmpty<{
    assignIds?: string[];
    unassignIds?: string[];
  }>(req)) as { assignIds?: string[]; unassignIds?: string[] };

  const assignIds = Array.isArray(body.assignIds) ? body.assignIds : [];
  const unassignIds = Array.isArray(body.unassignIds) ? body.unassignIds : [];

  if (assignIds.length) {
    await prisma.product.updateMany({
      where: { id: { in: assignIds } },
      data: { categoryId: params.id },
    });
  }

  if (unassignIds.length) {
    await prisma.product.updateMany({
      where: { id: { in: unassignIds }, categoryId: params.id },
      data: { categoryId: null },
    });
  }

  return NextResponse.json({ ok: true });
}
