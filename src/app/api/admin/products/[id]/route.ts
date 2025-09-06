// src/app/api/admin/products/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

export async function GET(_req: Request, ctx: unknown) {
  // ✅ cast locally to avoid validator error
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  return NextResponse.json({ product });
}

export async function PATCH(req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sku?: string | null;
    price?: number | null;
    inventory?: string | null;
    collection?: string | null;
    productImageUrl?: string | null;
    description?: string | null;
    visible?: boolean;
  };

  const { name, sku, price, inventory, collection, productImageUrl, description, visible } = body;

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(sku !== undefined ? { sku } : {}),
      ...(price !== undefined ? { price } : {}),
      ...(inventory !== undefined ? { inventory } : {}),
      ...(collection !== undefined ? { collection } : {}),
      ...(productImageUrl !== undefined ? { productImageUrl } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(visible !== undefined ? { visible: !!visible } : {})
    },
    select: { id: true }
  });

  return NextResponse.json({ ok: true, id: updated.id });
}

export async function DELETE(_req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  try {
    await prisma.product.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    // Prisma P2025 = record not found on delete
    if ((e as { code?: string }).code === 'P2025') {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Delete failed' }, { status: 500 });
  }
}
