import AdminInviteEmail from '@/emails/AdminInviteEmail';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getResend } from '@/lib/resend';
import { renderAsync } from '@react-email/render';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import * as React from 'react';

export const runtime = 'nodejs';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

const isHead = (u: unknown): boolean =>
  !!u && typeof u === 'object' && (u as Record<string, unknown>).role === 'HEAD';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isHead(session?.user)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['STAFF', 'VIEWER'] } },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }]
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

  if (!name || !email) {
    return NextResponse.json({ message: 'Name and email are required' }, { status: 400 });
  }

  if (role !== 'STAFF' && role !== 'VIEWER') {
    return NextResponse.json({ message: 'Role must be STAFF or VIEWER' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ message: 'Email already exists' }, { status: 409 });
  }

  // Password is optional — if not provided we generate a random one.
  // The user sets their real password via the welcome email link.
  const plainPassword = password?.trim() || crypto.randomBytes(16).toString('hex');
  const hashed = await bcrypt.hash(plainPassword, 12);

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role, source: 'LOCAL' },
    select: { id: true, name: true, email: true, role: true }
  });

  // Send welcome email with a one-time set-password link
  let emailSent = false;
  if (process.env.RESEND_ENABLED === 'true') {
    const resend = getResend();
    if (resend) {
      try {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await prisma.passwordToken.create({
          data: { userId: user.id, token, expiresAt }
        });

        const adminUrl = process.env.NEXTAUTH_URL_ADMIN ?? 'https://admin.prince-v.com';
        const setPasswordUrl = new URL('/admin/reset-password', adminUrl);
        setPasswordUrl.searchParams.set('token', token);
        const logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prince-v.com'}/assets/prince-foods-logo.png`;
        const invitedBy = (session?.user as { name?: string })?.name ?? undefined;

        const html = await renderAsync(
          React.createElement(AdminInviteEmail, {
            name,
            role: role as 'STAFF' | 'VIEWER',
            setPasswordUrl: setPasswordUrl.toString(),
            adminUrl,
            logoUrl,
            invitedBy,
            expiryDays: 7
          })
        );

        const from = process.env.RESEND_FROM ?? 'Prince Foods <no-reply@prince-v.com>';

        await resend.emails.send({
          from,
          to: email,
          subject: `You've been invited to the Prince Foods admin panel`,
          html,
          tags: [{ name: 'category', value: 'admin-invite' }]
        });

        emailSent = true;
      } catch (emailErr) {
        console.error('[staff/create] welcome email failed:', emailErr);
      }
    }
  }

  return NextResponse.json({ user, emailSent });
}
