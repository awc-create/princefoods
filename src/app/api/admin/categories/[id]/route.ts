import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import slugify from '@/utils/slugify';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}

export async function GET(_req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUserWithRole | undefined)?.role;
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

export async function PATCH(req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUserWithRole | undefined)?.role;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    position?: number;
    isActive?: boolean;
  };

  const data: Record<string, unknown> = {};
  if (typeof body.name === 'string' && body.name.trim()) {
    const n = body.name.trim();
    data.name = n;
    data.slug = slugify(n);
  }
  if (Number.isInteger(body.position)) data.position = body.position;
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive;

  const updated = await prisma.category.update({
    where: { id: params.id },
    data
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, ctx: unknown) {
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUserWithRole | undefined)?.role;
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
