import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUser {
  role?: Role | null;
}

const hasRole = (u: unknown): u is SessionUser =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

type Body =
  | { action: 'hide' | 'show' | 'delete'; ids: string[] }
  | {
      action: 'hide' | 'show' | 'delete';
      allMatching: true;
      search?: string;
      collections?: string[];
    };

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Partial<Body>;
  const action = body.action;

  if (action !== 'hide' && action !== 'show' && action !== 'delete') {
    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  }

  // allMatching mode (filtered)
  if ('allMatching' in body && body.allMatching === true) {
    const search = (body.search ?? '').trim();
    const collections = Array.isArray(body.collections) ? body.collections.filter(Boolean) : [];

    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
              { brand: { contains: search, mode: 'insensitive' as const } },
              { collection: { contains: search, mode: 'insensitive' as const } }
            ]
          }
        : {}),
      ...(collections.length ? { collection: { in: collections } } : {})
    };

    if (action === 'delete') {
      const r = await prisma.product.deleteMany({ where });
      return NextResponse.json({ ok: true, deleted: r.count });
    }

    const visible = action === 'show';
    const r = await prisma.product.updateMany({ where, data: { visible } });
    return NextResponse.json({ ok: true, updated: r.count, visible });
  }

  // ids mode
  const ids = Array.isArray((body as { ids?: unknown }).ids)
    ? ((body as { ids: unknown[] }).ids.filter((x) => typeof x === 'string') as string[])
    : [];

  if (!ids.length) return NextResponse.json({ message: 'No ids provided' }, { status: 400 });

  if (action === 'delete') {
    const r = await prisma.product.deleteMany({ where: { id: { in: ids } } });
    return NextResponse.json({ ok: true, deleted: r.count });
  }

  const visible = action === 'show';
  const r = await prisma.product.updateMany({ where: { id: { in: ids } }, data: { visible } });
  return NextResponse.json({ ok: true, updated: r.count, visible });
}
