// src/app/api/admin/send-welcome/route.ts
import { absUrl } from '@/lib/abs-url';
import { prisma } from '@/lib/prisma';
import { getResend } from '@/lib/resend';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  if (process.env.RESEND_ENABLED !== 'true') {
    return NextResponse.json(
      { ok: false, message: 'Email disabled (RESEND_ENABLED != "true")' },
      { status: 501 }
    );
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ ok: false, message: 'RESEND_API_KEY missing' }, { status: 501 });
  }

  const from = process.env.RESEND_FROM ?? 'Prince Foods <no-reply@prince-foods.com>';
  const replyTo = process.env.RESEND_REPLY_TO ?? undefined;

  // We no longer require a base URL env to exist here.
  // absUrl() will safely fall back to a canonical base (envs if present, or localhost),
  // so build-time or unusual runtime envs won’t throw.
  // If you *want* to hard-enforce a prod base, you can re-add a check.

  const users = await prisma.user.findMany({
    where: { source: 'WIX', welcomeStatus: 'PENDING' },
    take: 1000,
    select: { id: true, email: true, firstName: true }
  });

  let sent = 0;
  let failed = 0;
  const errors: Array<{ userId: string; email: string | null; error: string }> = [];

  for (const u of users) {
    try {
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.passwordToken.create({
        data: { userId: u.id, token, expiresAt }
      });

      // ✅ Build a safe absolute URL and then add the token query param
      const welcome = new URL(absUrl('/welcome'));
      welcome.searchParams.set('token', token);

      await resend.emails.send({
        from,
        ...(replyTo ? { replyTo } : {}),
        to: u.email ?? '',
        subject: 'Welcome to Prince Foods — finish your account',
        html: `
          <p>Hi${u.firstName ? ' ' + u.firstName : ''},</p>
          <p>We’ve moved to our new site. Please finish setting up your account:</p>
          <p><a href="${welcome.toString()}">Set your password and complete your profile</a></p>
          <p>Thanks,<br/>Prince Foods Team</p>
        `
      });

      await prisma.user.update({
        where: { id: u.id },
        data: { welcomeStatus: 'SENT', welcomedAt: new Date() }
      });

      sent++;
    } catch (e) {
      failed++;
      errors.push({
        userId: u.id,
        email: u.email ?? null,
        error: e instanceof Error ? e.message : 'Unknown error'
      });
    }
  }

  return NextResponse.json({
    ok: true,
    total: users.length,
    sent,
    failed,
    ...(errors.length ? { errors } : {})
  });
}
