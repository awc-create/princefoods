import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import slugify from '@/utils/slugify';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

type Params = { params: { id: string } };

export async function GET(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const parent = await prisma.category.findUnique({
    where: { id: params.id },
    include: {
      children: {
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { products: true } } }
      }
    }
  });
  if (!parent) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(parent);
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, position, isActive } = body as { name?: string; position?: number; isActive?: boolean };

  const data: any = {};
  if (typeof name === 'string' && name.trim()) {
    data.name = name.trim();
    data.slug = slugify(name);
  }
  if (Number.isInteger(position)) data.position = position;
  if (typeof isActive === 'boolean') data.isActive = isActive;

  const updated = await prisma.category.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const hasChildren = await prisma.category.count({ where: { parentId: params.id } });
  const hasProducts = await prisma.product.count({ where: { categoryId: params.id } });
  if (hasChildren || hasProducts) {
    return NextResponse.json(
      { error: 'Cannot delete: category has children or products' },
      { status: 400 }
    );
  }
  await prisma.category.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
