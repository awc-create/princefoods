// src/app/api/admin/send-welcome/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  // --- config guards (don’t crash build/runtime if unconfigured) ---
  if (process.env.RESEND_ENABLED !== 'true') {
    return NextResponse.json(
      { ok: false, message: 'Email disabled (RESEND_ENABLED != "true")' },
      { status: 501 }
    );
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'RESEND_API_KEY missing' }, { status: 501 });
  }
  const from = process.env.RESEND_FROM ?? 'Prince Foods <no-reply@prince-foods.com>';
  const replyTo = process.env.RESEND_REPLY_TO ?? undefined;

  // Prefer admin URL for onboarding; fallback to public site URL.
  const baseUrl =
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    null;

  if (!baseUrl) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Base URL missing (set NEXT_PUBLIC_ADMIN_URL or NEXT_PUBLIC_SITE_URL)'
      },
      { status: 501 }
    );
  }

  const resend = new Resend(apiKey);

  // --- fetch pending users ---
  const users = await prisma.user.findMany({
    where: { source: 'WIX', welcomeStatus: 'PENDING' },
    take: 1000,
    select: { id: true, email: true, firstName: true } // only what we need
  });

  let sent = 0;
  let failed = 0;
  const errors: Array<{ userId: string; email: string | null; error: string }> = [];

  for (const u of users) {
    try {
      // Generate token (7 days expiry)
      const token = crypto.randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.passwordToken.create({
        data: { userId: u.id, token, expiresAt }
      });

      const url = new URL('/welcome', baseUrl);
      url.searchParams.set('token', token);

      // Send email
      await resend.emails.send({
        from,
        ...(replyTo ? { reply_to: replyTo } : {}),
        to: u.email ?? '',
        subject: 'Welcome to Prince Foods — finish your account',
        html: `
          <p>Hi${u.firstName ? ' ' + u.firstName : ''},</p>
          <p>We’ve moved to our new site. Please finish setting up your account:</p>
          <p><a href="${url.toString()}">Set your password and complete your profile</a></p>
          <p>Thanks,<br/>Prince Foods Team</p>
        `
      });

      // Mark as sent
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
      // Optionally: cleanup token on failure (comment out if you want to keep it)
      // await prisma.passwordToken.deleteMany({ where: { userId: u.id } }).catch(() => {});
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
