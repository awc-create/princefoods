import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export const runtime = 'nodejs';

// ⛔️ remove the alias
// type Params = { params: { id: string } };

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  if (!(prisma as any)?.category?.findUnique || !(prisma as any)?.product?.findMany) {
    return NextResponse.json({ message: 'Prisma client is stale — run `npx prisma generate`' }, { status: 500 });
  }

  const cat = await prisma.category.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const products = await prisma.product.findMany({
    where: { categoryId: params.id },
    orderBy: [{ createdAt: 'desc' }],
    select: { id: true, name: true, sku: true, price: true, productImageUrl: true, visible: true },
  });

  return NextResponse.json(products);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role as 'HEAD'|'STAFF'|'VIEWER'|undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { assignIds = [], unassignIds = [] } = (await req.json().catch(()=>({}))) as {
    assignIds?: string[]; unassignIds?: string[];
  };

  if (Array.isArray(assignIds) && assignIds.length) {
    await prisma.product.updateMany({ where: { id: { in: assignIds } }, data: { categoryId: params.id } });
  }

  if (Array.isArray(unassignIds) && unassignIds.length) {
    await prisma.product.updateMany({ where: { id: { in: unassignIds }, categoryId: params.id }, data: { categoryId: null } });
  }

  return NextResponse.json({ ok: true });
}
