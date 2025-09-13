import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { email, code, token } = await req.json();

  if (!email || (!code && !token)) {
    return NextResponse.json({ ok: false, error: 'Missing email and code/token' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired' }, { status: 400 });
  }

  const now = new Date();

  const pt = await prisma.passwordToken.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: now },
      ...(token ? { token } : {}),
      ...(code ? { code } : {})
    }
  });

  if (!pt) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.passwordToken.update({ where: { id: pt.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        welcomeStatus: 'COMPLETED',
        welcomedAt: new Date()
      }
    })
  ]);

  return NextResponse.json({ ok: true });
}
