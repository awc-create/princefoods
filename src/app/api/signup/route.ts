// src/app/api/signup/route.ts
import { getFeaturedCategories } from '@/lib/catalog';
import { sendWelcomeVerifyEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { issueEmailVerification } from '@/lib/verify';
import bcrypt from 'bcryptjs';
import type { CountryCode } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      country = 'GB',
      next = '/'
    } = (await req.json()) as {
      firstName?: string;
      lastName?: string;
      email: string;
      password: string;
      phone?: string;
      country?: string;
      next?: string;
    };

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Email already exists' }, { status: 400 });
    }

    let phoneE164: string | undefined;
    if (phone) {
      try {
        const cc = /^[A-Za-z]{2}$/.test(String(country))
          ? (country.toUpperCase() as CountryCode)
          : undefined;
        const p = cc ? parsePhoneNumber(phone, cc) : parsePhoneNumber(phone);
        if (p?.isValid()) phoneE164 = p.number;
      } catch {
        // ignore parse errors
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || email;

    await prisma.user.create({
      data: {
        email,
        password: hash,
        firstName,
        lastName,
        name,
        phoneRaw: phone ?? null,
        phoneE164: phoneE164 ?? null,
        phoneCountry: (country || 'GB').toUpperCase(),
        source: 'LOCAL',
        role: 'VIEWER'
      }
    });

    // Fire-and-forget: issue verification + send email
    (async () => {
      try {
        const issued = await issueEmailVerification(email);
        if (!issued.ok) return; // throttled/cooldown

        const siteUrl =
          process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';
        const verifyUrl = `${siteUrl}/verify?email=${encodeURIComponent(email)}&token=${encodeURIComponent(
          issued.tokenRaw
        )}&next=${encodeURIComponent(next || '/')}`;

        const categories = await getFeaturedCategories(6).catch(() => []);

        await sendWelcomeVerifyEmail({
          to: email,
          name,
          code: issued.code,
          verifyUrl,
          categories,
          expiresInMinutes: issued.expiresInMinutes
        });

        await prisma.user.update({
          where: { email },
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
