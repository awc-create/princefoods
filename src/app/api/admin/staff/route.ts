import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'HEAD') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  // Return only STAFF and VIEWER (not HEAD)
  const users = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'VIEWER'] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json(users);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== 'HEAD') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ message: 'Name, email and password are required' }, { status: 400 });
  }

  if (!['STAFF', 'VIEWER'].includes(role)) {
    return NextResponse.json({ message: 'Role must be STAFF or VIEWER' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: 'Email already exists' }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashed,
      role,
      source: 'LOCAL',
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user });
}
