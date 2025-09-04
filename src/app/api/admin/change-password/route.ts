import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type SessionUserWithId = { id?: string | null };

function hasId(u: unknown): u is SessionUserWithId {
  return !!u && typeof u === 'object' && 'id' in (u as Record<string, unknown>);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !hasId(session.user) || !session.user.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ message: 'Invalid input' }, { status: 400 });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true },
  });

  if (!user?.password) {
    return NextResponse.json(
      { message: 'Password cannot be changed for this account.' },
      { status: 400 }
    );
  }

  const ok = await bcrypt.compare(currentPassword, user.password);
  if (!ok) {
    return NextResponse.json({ message: 'Current password is incorrect.' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  return NextResponse.json({ ok: true, message: 'Password updated.' });
}
