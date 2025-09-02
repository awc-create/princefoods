import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

type Params = { params: { id: string } };

export async function POST(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!['HEAD', 'STAFF'].includes((session?.user as any)?.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const src = await prisma.product.findUnique({ where: { id: params.id } });
  if (!src) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const cloneId = `${src.id}-copy-${Math.random().toString(36).slice(2, 7)}`;
  const cloneName = `${src.name} (Copy)`;

  const { id, createdAt, ...rest } = src as any;

  const created = await prisma.product.create({
    data: {
      ...rest,
      id: cloneId,
      name: cloneName,
      sku: src.sku ? `${src.sku}-COPY` : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: created.id });
}
