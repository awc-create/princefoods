import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!['HEAD','STAFF'].includes((session?.user as any)?.role)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json();
  const { name, sku, price, inventory, collection, productImageUrl, description, visible } = body || {};

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      name, sku, price, inventory, collection, productImageUrl, description,
      visible: !!visible,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: updated.id });
}
