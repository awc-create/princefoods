import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

const isHead = (u: unknown): boolean =>
  !!u && typeof u === 'object' && (u as Record<string, unknown>).role === 'HEAD';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
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
  if (!isHead(session?.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role } = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
    role?: Exclude<Role, 'HEAD'>;
  };

  if (!name || !email || !password) {
    return NextResponse.json({ message: 'Name, email and password are required' }, { status: 400 });
  }

  if (role !== 'STAFF' && role !== 'VIEWER') {
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
