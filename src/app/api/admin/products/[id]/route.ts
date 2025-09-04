import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

interface Params {
  params: { id: string };
}
type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, { params }: Params) {
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

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
