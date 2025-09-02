import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import bcrypt from "bcryptjs";
import { parsePhoneNumber } from "libphonenumber-js";

export async function POST(req: Request) {
  const { firstName, lastName, email, password, phone, country = "GB" } = await req.json();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ ok: false, error: "Email already exists" }, { status: 400 });

  let phoneE164: string | undefined;
  if (phone) {
    try {
      const p = parsePhoneNumber(phone, country as any);
      if (p?.isValid()) phoneE164 = p.number;
    } catch {}
  }

  const hash = await bcrypt.hash(password, 12);
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || email;

  await prisma.user.create({
    data: {
      email,
      password: hash,
      firstName,
      lastName,
      name,
      phoneRaw: phone ?? null,
      phoneE164: phoneE164 ?? null,
      phoneCountry: country,
      source: "LOCAL",
      role: "VIEWER",
    },
  });

  return NextResponse.json({ ok: true });
}
