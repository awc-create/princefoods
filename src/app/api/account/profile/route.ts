// src/app/api/account/profile/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function digitsOnly(s: string) {
  return s.replace(/[^\d]/g, '');
}

// same loose rule as checkout: 6–15 digits, keep + if provided
function normalizePhoneLoose(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const d = digitsOnly(t);
  if (d.length < 6 || d.length > 15) return '';
  return t.startsWith('+') ? t : d;
}

// ✅ for non-nullable Prisma strings: return `undefined` to skip updates
function cleanString(v: unknown, maxLen: number): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const lower = s.toLowerCase();
  if (lower === 'undefined' || lower === 'null') return undefined;
  return s.slice(0, maxLen);
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const email = session?.user?.email;
    if (!email) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body: unknown = await req.json();
    const b = body as Record<string, unknown>;

    const firstName = cleanString(b.firstName, 80);
    const lastName = cleanString(b.lastName, 80);
    const name = cleanString(b.name, 120);

    const phoneRaw = cleanString(b.phoneE164, 32);
    const phoneNorm = phoneRaw ? normalizePhoneLoose(phoneRaw) : undefined;

    // If user typed something but it normalised to empty -> reject (prevents junk saved)
    if (phoneRaw && !phoneNorm) {
      return NextResponse.json(
        { ok: false, error: 'Invalid phone. Use digits or +44…, 6–15 digits.' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { email },
      data: {
        // ✅ only set if provided; otherwise skip update
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(name !== undefined ? { name } : {}),
        ...(phoneNorm !== undefined ? { phoneE164: phoneNorm } : {})
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[account.profile]', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}
