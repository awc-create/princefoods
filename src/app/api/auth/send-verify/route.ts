import { sendWelcomeVerifyEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

const EXP_MIN = Number(process.env.EMAIL_CODE_EXP_MIN ?? 15);

function code6() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  try {
    const { email, name, categories, bestSellers } = await req.json();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email required' }, { status: 400 });
    }

    // Ensure user exists
    const user =
      (await prisma.user.findUnique({ where: { email } })) ??
      (await prisma.user.create({
        data: {
          email,
          name: name ?? email.split('@')[0],
          role: 'VIEWER'
        }
      }));

    // Cleanup expired tokens
    const now = new Date();
    await prisma.passwordToken.deleteMany({
      where: { userId: user.id, usedAt: null, expiresAt: { lt: now } }
    });

    // Throttle: if there is an active token, avoid re-sending
    const active = await prisma.passwordToken.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: now } }
    });
    if (active) {
      return NextResponse.json({ ok: true, alreadySent: true });
    }

    // Create fresh token + code
    const token = crypto.randomUUID();
    const code = code6();
    const expiresAt = new Date(Date.now() + EXP_MIN * 60 * 1000);

    await prisma.passwordToken.create({
      data: { userId: user.id, token, code, expiresAt }
    });

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';
    const verifyUrl = `${siteUrl}/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

    await sendWelcomeVerifyEmail({
      to: email,
      name,
      code,
      verifyUrl,
      expiresInMinutes: EXP_MIN,
      categories,
      bestSellers
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('send-verify error', err);
    return NextResponse.json({ ok: false, error: 'Failed to send' }, { status: 500 });
  }
}
