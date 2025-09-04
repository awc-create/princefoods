// src/app/api/admin/products/[id]/duplicate/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

type Params = { params: { id: string } };
type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type SessionUserWithRole = { role?: Role | null };

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user) ? (session!.user.role ?? undefined) : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const src = await prisma.product.findUnique({ where: { id: params.id } });
  if (!src) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const cloneId = `${src.id}-copy-${Math.random().toString(36).slice(2, 7)}`;
  const cloneName = `${src.name} (Copy)`;

  // Omit immutable/auto fields that exist on your model (no updatedAt on this schema)
  const { id: _oldId, createdAt: _createdAt, ...rest } = src;

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
