import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'HEAD') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, role, password } = await req.json();

  const data: any = {};
  if (name) data.name = name;
  if (email) data.email = email;
  if (role) {
    if (!['STAFF', 'VIEWER'].includes(role)) {
      return NextResponse.json({ message: 'Role must be STAFF or VIEWER' }, { status: 400 });
    }
    data.role = role;
  }
  if (password) {
    data.password = await bcrypt.hash(password, 12);
  }

  try {
    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ message: 'Update failed' }, { status: 400 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'HEAD') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  // Don't allow deleting HEAD via this endpoint
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, role: true },
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
