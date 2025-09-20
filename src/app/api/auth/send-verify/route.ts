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
      next = '/',
      resend = false
    } = (await req.json()) as {
      email: string;
      name?: string | null;
      next?: string;
      resend?: boolean;
    };

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, emailVerified: true }
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const issued = await issueEmailVerification(email, resend ? 'resend' : 'initial');

    // If resend requested but no prior verification/cooldown, return ok:true to avoid enumeration.
    if (!issued.ok) {
      const payload = issued.reason === 'cooldown' ? { ok: true, throttled: true } : { ok: true }; // noop
      return NextResponse.json(payload);
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';

    // Use the legacy token for YOUR /verify page flow
    const token = issued.tokenRawLegacy;

    const verifyUrl = `${siteUrl}/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(
      token
    )}&next=${encodeURIComponent(next ?? '/')}`;

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
