import { getFeaturedCategories } from '@/lib/catalog';
import { sendWelcomeVerifyEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { magicLinkLimiter } from '@/lib/rate-limit';
import { getClientIp, tooManyRequests } from '@/lib/rate-limit-response';
import { issueEmailVerification } from '@/lib/verify';
import bcrypt from 'bcryptjs';
import type { CountryCode } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js';
import { NextResponse } from 'next/server';

type IssuedOk =
  | {
      ok: true;
      code: string;
      expiresAt: Date;
      expiresInMinutes: number;
      tokenRawNextAuth?: string;
      tokenRawLegacy?: string;
      // legacy runtime probe for tokenRaw supported below
    }
  | { ok: false; reason: 'noop' | 'cooldown' };

function resolveSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-foods.com';
}

function resolveOriginForNextAuth(): string {
  // Prefer admin for backoffice sign-in flows if set, otherwise public
  return (
    process.env.NEXTAUTH_URL_PUBLIC ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    process.env.NEXTAUTH_URL_ADMIN ??
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    resolveSiteUrl()
  );
}

function buildNextAuthMagicLink(params: {
  origin: string;
  email: string;
  next?: string;
  tokenNextAuth: string;
}) {
  const e = encodeURIComponent(params.email);
  const t = encodeURIComponent(params.tokenNextAuth);
  const cb = encodeURIComponent(new URL(params.next ?? '/', params.origin).toString());
  return `${params.origin}/api/auth/callback/email?email=${e}&token=${t}&callbackUrl=${cb}`;
}

function buildLegacyVerifyUrl(params: {
  siteUrl: string;
  email: string;
  tokenLegacy: string;
  next?: string;
}) {
  const e = encodeURIComponent(params.email);
  const t = encodeURIComponent(params.tokenLegacy);
  const n = encodeURIComponent(params.next ?? '/');
  return `${params.siteUrl}/verify?email=${e}&token=${t}&next=${n}`;
}

export async function POST(req: Request) {
  try {
    const rl = magicLinkLimiter(getClientIp(req));
    if (!rl.allowed) return tooManyRequests(rl);

    const body = (await req.json()) as {
      firstName?: string;
      lastName?: string;
      email: string;
      password: string;
      phone?: string;
      country?: string;
      next?: string;
    };

    const { firstName, lastName, email, password, phone, country = 'GB', next = '/' } = body;

    // Fix 6: enforce minimum password strength server-side
    const pw = String(password ?? '');
    if (pw.length < 8) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 8 characters.' },
        { status: 400 }
      );
    }
    if (!/[A-Za-z]/.test(pw)) {
      return NextResponse.json(
        { ok: false, error: 'Password must contain at least one letter.' },
        { status: 400 }
      );
    }
    if (!/[0-9!@#$%^&*]/.test(pw)) {
      return NextResponse.json(
        { ok: false, error: 'Password must contain a number or special character.' },
        { status: 400 }
      );
    }

    const emailNorm = String(email ?? '')
      .trim()
      .toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email already exists' }, { status: 400 });
    }

    let phoneE164: string | undefined;
    if (phone) {
      try {
        const cc = /^[A-Za-z]{2}$/.test(String(country ?? ''))
          ? (String(country).toUpperCase() as CountryCode)
          : undefined;
        const p = cc ? parsePhoneNumber(phone, cc) : parsePhoneNumber(phone);
        if (p?.isValid()) phoneE164 = p.number;
      } catch {
        // ignore parse errors
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || emailNorm;

    await prisma.user.create({
      data: {
        email: emailNorm,
        password: hash,
        firstName,
        lastName,
        name,
        phoneRaw: phone ?? null,
        phoneE164: phoneE164 ?? null,
        phoneCountry: String(country ?? 'GB').toUpperCase(),
        source: 'LOCAL',
        role: 'VIEWER'
      }
    });

    // Fire-and-forget: issue verification + send email
    (async () => {
      try {
        const issued = (await issueEmailVerification(emailNorm, 'initial')) as IssuedOk;
        if (!issued.ok) return;

        const origin = resolveOriginForNextAuth();
        const siteUrl = resolveSiteUrl();

        // Prefer direct NextAuth one-click login link
        const tokenNextAuth = issued.tokenRawNextAuth;

        // Legacy fallbacks
        let tokenLegacy = issued.tokenRawLegacy;
        if (!tokenLegacy) {
          const maybeLegacy = (issued as unknown as { tokenRaw?: unknown }).tokenRaw;
          if (typeof maybeLegacy === 'string') tokenLegacy = maybeLegacy;
        }

        const verifyUrl = tokenNextAuth
          ? buildNextAuthMagicLink({
              origin,
              email: emailNorm,
              next,
              tokenNextAuth
            })
          : tokenLegacy
            ? buildLegacyVerifyUrl({
                siteUrl,
                email: emailNorm,
                tokenLegacy,
                next
              })
            : null;

        if (!verifyUrl) return;

        const categories = await getFeaturedCategories(6).catch(() => []);

        await sendWelcomeVerifyEmail({
          to: emailNorm,
          name,
          code: issued.code,
          verifyUrl,
          categories,
          expiresInMinutes: issued.expiresInMinutes
        });

        await prisma.user.update({
          where: { email: emailNorm },
          data: { welcomeStatus: 'SENT', welcomedAt: new Date() }
        });
      } catch (err) {
        console.error('[welcome-verify-email] failed:', err);
      }
    })();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[signup] error', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
