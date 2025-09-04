// src/app/api/admin/products/[id]/duplicate/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export const runtime = 'nodejs';

// If sku isn't unique, we must use findFirst, not findUnique
async function uniqueSku(base: string | null | undefined) {
  if (!base) return null;
  const first = `${base}-COPY`;
  let candidate = first;
  let n = 1;

  while (n <= 50) {
    const exists = await prisma.product.findFirst({
      where: { sku: candidate },
      select: { id: true }
    });
    if (!exists) return candidate;
    n += 1;
    candidate = `${first}-${n}`;
  }
  return `${first}-${crypto.randomBytes(3).toString('hex')}`;
}

export async function POST(_req: Request, ctx: unknown) {
  // Cast second arg locally to satisfy Next's validator
  const { params } = ctx as { params: { id: string } };

  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const src = await prisma.product.findUnique({ where: { id: params.id } });
  if (!src) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  // No `any`, no `updatedAt` (since your schema doesn’t have it)
  const { id: _oldId, createdAt: _createdAt, ...rest } = src;

  const cloneId = crypto.randomUUID();
  const cloneName = `${src.name} (Copy)`;
  const newSku = await uniqueSku(src.sku ?? undefined);

  const created = await prisma.product.create({
    data: {
      ...rest,
      id: cloneId,
      name: cloneName,
      sku: newSku // stays null if source had no SKU
    },
    select: { id: true }
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}
