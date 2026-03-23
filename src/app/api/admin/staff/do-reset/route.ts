// src/app/api/admin/staff/do-reset/route.ts
// Validates the token from the email link and sets the new password
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { token, newPassword } = (await req.json().catch(() => ({}))) as {
      token?: string;
      newPassword?: string;
    };

    if (!token || !newPassword || newPassword.length < 6) {
      return NextResponse.json({ ok: false, message: 'Invalid input' }, { status: 400 });
    }

    const record = await prisma.passwordToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, role: true } } }
    });

    if (!record) {
      return NextResponse.json(
        { ok: false, message: 'Invalid or expired reset link.' },
        { status: 400 }
      );
    }

    if (record.usedAt) {
      return NextResponse.json(
        { ok: false, message: 'This reset link has already been used.' },
        { status: 400 }
      );
    }

    if (record.expiresAt < new Date()) {
      return NextResponse.json(
        { ok: false, message: 'This reset link has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed }
      }),
      prisma.passwordToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() }
      })
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[do-reset] error:', err);
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
