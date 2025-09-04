// src/app/api/admin/products/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export const runtime = 'nodejs';

export async function GET(_req: Request, ctx: unknown) {
  // ✅ Cast locally to avoid Next’s validator complaint
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

  const body = (await req.json().catch(() => ({}))) as { visible?: boolean };
  if (typeof body.visible !== 'boolean') {
    return NextResponse.json({ message: 'Nothing to update' }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: { visible: body.visible },
    select: { id: true, visible: true }
  });

  return NextResponse.json(updated);
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
  } catch (e) {
    // Prisma P2025 = record to delete not found
    const msg = (e as { code?: string })?.code === 'P2025' ? 'Not found' : 'Delete failed';
    const status = msg === 'Not found' ? 404 : 500;
    return NextResponse.json({ message: msg }, { status });
  }
}
