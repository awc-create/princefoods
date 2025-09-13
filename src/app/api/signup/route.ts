// src/app/api/signup/route.ts
import { sendWelcomeEmail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import type { CountryCode } from 'libphonenumber-js';
import { parsePhoneNumber } from 'libphonenumber-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const {
    firstName,
    lastName,
    email,
    password,
    phone,
    country = 'GB'
  } = (await req.json()) as {
    firstName?: string;
    lastName?: string;
    email: string;
    password: string;
    phone?: string;
    country?: string;
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

  // Send welcome email (don’t block signup if it fails)
  (async () => {
    try {
      await sendWelcomeEmail({ to: email, name });
      await prisma.user.update({
        where: { email },
        data: { welcomeStatus: 'SENT', welcomedAt: new Date() }
      });
    } catch (err) {
      console.error('[welcome-email] failed:', err);
    }
  })();

  return NextResponse.json({ ok: true });
}
