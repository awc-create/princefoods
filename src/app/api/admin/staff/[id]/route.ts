// src/app/api/admin/staff/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

// Inline the shape so we don’t need a named interface.
const isHead = (u: unknown): u is { role?: Role | null } =>
  !!u && typeof u === 'object' && (u as Record<string, unknown>).role === 'HEAD';

// Promise type guard to avoid `any`
function isPromise<T = unknown>(v: unknown): v is Promise<T> {
  return (
    !!v &&
    typeof v === 'object' &&
    'then' in (v as object) &&
    typeof (v as { then: unknown }).then === 'function'
  );
}

// Helper: supports both { params: {...} } and { params: Promise<...> }.
async function getParams<T extends Record<string, unknown>>(ctx: unknown): Promise<T> {
  const raw = (ctx as { params?: unknown })?.params;
  if (isPromise<unknown>(raw)) {
    return (await raw) as T;
  }
  return (raw ?? {}) as T;
}

export async function PATCH(req: Request, ctx: unknown) {
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { id } = await getParams<{ id: string }>(ctx);

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    role?: Exclude<Role, 'HEAD'>;
    password?: string;
  };

  const data: Prisma.UserUpdateInput = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.email !== undefined) data.email = body.email;
  if (body.role !== undefined) {
    if (body.role !== 'STAFF' && body.role !== 'VIEWER') {
      return NextResponse.json({ message: 'Role must be STAFF or VIEWER' }, { status: 400 });
    }
    data.role = body.role;
  }
  if (body.password !== undefined && body.password) {
    data.password = await bcrypt.hash(body.password, 12);
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true }
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: unknown) {
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { id } = await getParams<{ id: string }>(ctx);

  // Don't allow deleting HEAD via this endpoint
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true }
  });

  if (!target) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  if (target.role === 'HEAD') {
    return NextResponse.json({ message: 'Cannot delete HEAD via this endpoint' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
