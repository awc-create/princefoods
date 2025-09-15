// src/app/api/auth/send-verify/route.ts
import { getFeaturedCategories } from '@/lib/catalog';
import { sendWelcomeVerifyEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { issueEmailVerification } from '@/lib/verify';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const {
      email,
      name,
      next = '/'
    } = (await req.json()) as {
      email: string;
      name?: string | null;
      next?: string;
    };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true }
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // If already verified, you can treat as OK (idempotent) or return a soft error.
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const issued = await issueEmailVerification(email);
    if (!issued.ok) {
      // throttled — return success so UI doesn't loop; you can include a hint
      return NextResponse.json({
        ok: true,
        throttled: true,
        retryInSeconds: issued.retryInSeconds
      });
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';
    const verifyUrl = `${siteUrl}/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(
      issued.tokenRaw
    )}&next=${encodeURIComponent(next || '/')}`;

    const categories = await getFeaturedCategories(6).catch(() => []);

    await sendWelcomeVerifyEmail({
      to: email,
      name: name ?? user.name ?? undefined,
      code: issued.code,
      verifyUrl,
      categories,
      expiresInMinutes: issued.expiresInMinutes
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[send-verify] error', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
