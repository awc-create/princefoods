import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { parsePhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';

export async function POST(req: Request) {
  const { token, firstName, lastName, phone, country = 'GB', password } = (await req.json()) as {
    token: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    country?: string;
    password: string;
  };

  const t = await prisma.passwordToken.findUnique({ where: { token } });
  if (!t || t.usedAt || t.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, error: 'Invalid or expired token' }, { status: 400 });
  }

  let phoneE164: string | undefined;
  if (phone) {
    try {
      const cc = /^[A-Za-z]{2}$/.test(String(country)) ? (country.toUpperCase() as CountryCode) : undefined;
      const p = cc ? parsePhoneNumber(phone, cc) : parsePhoneNumber(phone);
      if (p?.isValid()) phoneE164 = p.number;
    } catch {
      /* ignore */
    }
  }

  const hash = await bcrypt.hash(password, 12);
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();

  await prisma.user.update({
    where: { id: t.userId },
    data: {
      firstName,
      lastName,
      phoneRaw: phone ?? null,
      phoneE164: phoneE164 ?? null,
      phoneCountry: (country || 'GB').toUpperCase(),
      password: hash,
      name: name || undefined,
      welcomeStatus: 'COMPLETED',
    },
  });

  await prisma.passwordToken.update({
    where: { id: t.id },
    data: { usedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
