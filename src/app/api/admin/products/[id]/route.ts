import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as any)?.role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!(session?.user as any)?.role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { visible } = body as { visible?: boolean };
  if (typeof visible !== 'boolean') {
    return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { visible },
    select: { id: true, visible: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!['HEAD', 'STAFF'].includes((session?.user as any)?.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
