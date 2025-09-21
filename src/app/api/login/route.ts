// src/app/api/login/route.ts
import { getFeaturedCategories } from '@/lib/catalog';
import { sendWelcomeVerifyEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { issueEmailVerification } from '@/lib/verify';
import { NextResponse } from 'next/server';

type IssuedOk =
  | {
      ok: true;
      code: string;
      expiresAt: Date;
      expiresInMinutes: number;
      tokenRawNextAuth?: string;
      tokenRawLegacy?: string;
      // legacy compatibility if your codegen still returns tokenRaw:
      // (we probe it at runtime in a type-safe way below)
    }
  | { ok: false; reason: 'noop' | 'cooldown' };

function getHeaderHost(req: Request): string | null {
  try {
    return req.headers.get('host');
  } catch {
    return null;
  }
}

function normalizeHostFromUrl(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, '').toLowerCase();
  }
}

function pickOrigin(currentHost?: string | null): string {
  const adminEnv =
    process.env.NEXTAUTH_URL_ADMIN ??
    process.env.NEXT_PUBLIC_ADMIN_URL ??
    (process.env.ADMIN_DOMAIN ? `https://${process.env.ADMIN_DOMAIN}` : undefined);

  const publicEnv =
    process.env.NEXTAUTH_URL_PUBLIC ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.DOMAIN ? `https://${process.env.DOMAIN}` : undefined);

  const host = (currentHost ?? '').toLowerCase();

  // If current host clearly looks like admin, prefer admin origin
  const adminHost = adminEnv ? normalizeHostFromUrl(adminEnv) : '';
  const isAdminRequest = !!host && (host.startsWith('admin.') || (adminHost && host === adminHost));

  if (isAdminRequest && adminEnv) return adminEnv;
  if (publicEnv) return publicEnv;

  // Last-resort default to https://localhost just to be safe
  return 'https://localhost';
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
    const { email, next } = (await req.json()) as { email: string; next?: string };

    const emailNorm = String(email ?? '')
      .trim()
      .toLowerCase();
    if (!emailNorm || !emailNorm.includes('@')) {
      // Do not reveal any detail (avoid enumeration)
      return NextResponse.json({ ok: true });
    }

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) {
      // Succeed silently (avoid enumeration)
      return NextResponse.json({ ok: true });
    }

    const issued = (await issueEmailVerification(emailNorm, 'resend')) as IssuedOk;

    if (!issued.ok) {
      // Respect cooldown/noop without leaking info
      return NextResponse.json({ ok: true });
    }

    const host = getHeaderHost(req);
    const origin = pickOrigin(host);
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? origin;

    // Prefer direct NextAuth token when available
    const tokenNextAuth = issued.tokenRawNextAuth;

    // Legacy fallbacks: tokenRawLegacy or old tokenRaw (runtime probe, no `any`)
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
        : // If neither token exists, still succeed but don’t send email
          null;

    if (!verifyUrl) {
      return NextResponse.json({ ok: true });
    }

    const categories = await getFeaturedCategories(6).catch(() => []);

    await sendWelcomeVerifyEmail({
      to: emailNorm,
      name: user.name ?? emailNorm,
      code: issued.code,
      verifyUrl,
      categories,
      expiresInMinutes: issued.expiresInMinutes
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[login/start] error', e);
    // Always succeed for the client to avoid enumeration timing channels
    return NextResponse.json({ ok: true });
  }
}
