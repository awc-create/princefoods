// src/app/api/admin/staff/request-reset/route.ts
// HEAD admin triggers a password reset link sent directly to the staff member
import AdminInviteEmail from '@/emails/AdminInviteEmail';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getResend } from '@/lib/resend';
import { renderAsync } from '@react-email/render';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import * as React from 'react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isHead = (u: unknown): boolean =>
  !!u && typeof u === 'object' && (u as Record<string, unknown>).role === 'HEAD';

export async function POST(req: Request) {
  // Only HEAD can trigger a reset for another staff member
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
    return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
  }

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string };

  if (!userId) {
    return NextResponse.json({ ok: false, message: 'userId required' }, { status: 400 });
  }

  const staff = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true }
  });

  if (!staff || !staff.email) {
    return NextResponse.json({ ok: false, message: 'User not found' }, { status: 404 });
  }

  if (staff.role !== 'STAFF' && staff.role !== 'VIEWER') {
    return NextResponse.json(
      { ok: false, message: 'Can only reset STAFF or VIEWER accounts' },
      { status: 400 }
    );
  }

  if (process.env.RESEND_ENABLED !== 'true') {
    return NextResponse.json(
      { ok: false, message: 'Email is disabled (RESEND_ENABLED != true)' },
      { status: 501 }
    );
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ ok: false, message: 'RESEND_API_KEY missing' }, { status: 501 });
  }

  // Invalidate any existing unused tokens for this user
  await prisma.passwordToken.updateMany({
    where: { userId: staff.id, usedAt: null },
    data: { usedAt: new Date() }
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.passwordToken.create({
    data: { userId: staff.id, token, expiresAt }
  });

  const adminUrl = process.env.NEXTAUTH_URL_ADMIN ?? 'https://admin.prince-v.com';
  const resetUrl = new URL('/admin/reset-password', adminUrl);
  resetUrl.searchParams.set('token', token);

  const logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prince-v.com'}/assets/prince-foods-logo.png`;
  const invitedBy = (session?.user as { name?: string })?.name ?? undefined;

  const html = await renderAsync(
    React.createElement(AdminInviteEmail, {
      name: staff.name ?? staff.email,
      role: staff.role as 'STAFF' | 'VIEWER',
      setPasswordUrl: resetUrl.toString(),
      adminUrl,
      logoUrl,
      invitedBy,
      expiryDays: 1
    })
  );

  const from = process.env.RESEND_FROM ?? 'Prince Foods <no-reply@prince-v.com>';

  await resend.emails.send({
    from,
    to: staff.email,
    subject: 'Reset your Prince Foods admin password',
    html,
    tags: [{ name: 'category', value: 'admin-reset' }]
  });

  return NextResponse.json({ ok: true });
}
