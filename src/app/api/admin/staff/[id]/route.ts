import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface Params {
  params: { id: string };
}
type Role = 'HEAD' | 'STAFF' | 'VIEWER';

const isHead = (u: unknown): boolean =>
  !!u && typeof u === 'object' && (u as Record<string, unknown>).role === 'HEAD';

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    role?: Exclude<Role, 'HEAD'>;
    password?: string;
  };

  const data: Prisma.UserUpdateInput = {};
  if (body.name) data.name = body.name;
  if (body.email) data.email = body.email;
  if (body.role) {
    if (body.role !== 'STAFF' && body.role !== 'VIEWER') {
      return NextResponse.json({ message: 'Role must be STAFF or VIEWER' }, { status: 400 });
    }
    data.role = body.role;
  }
  if (body.password) {
    data.password = await bcrypt.hash(body.password, 12);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true }
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  // Don't allow deleting HEAD via this endpoint
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true }
  });

  if (!target) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  if (target.role === 'HEAD') {
    return NextResponse.json({ message: 'Cannot delete HEAD via this endpoint' }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
