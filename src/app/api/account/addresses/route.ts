// src/app/api/account/addresses/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Tx = Prisma.TransactionClient;

type AddressKind = 'SHIPPING' | 'BILLING' | 'BOTH';

function json(ok: boolean, payload: Record<string, unknown> = {}, status = 200) {
  return NextResponse.json({ ok, ...payload }, { status });
}

function bad(error: string, status = 400) {
  return json(false, { error }, status);
}

function cleanRequired(v: unknown, max = 200): string {
  const t = typeof v === 'string' ? v.trim() : '';
  return t.slice(0, max);
}

function cleanOptional(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeCountry(v: unknown, fallback = 'GB') {
  let s = typeof v === 'string' ? v.trim().toUpperCase() : '';
  if (!s) return fallback;

  if (s === 'UK' || s === 'U.K.') s = 'GB';
  if (s === 'UNITED KINGDOM' || s === 'GREAT BRITAIN') s = 'GB';

  if (s.length !== 2) return fallback;
  return s;
}

function normalizePhoneE164(raw: unknown, country: string): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;

  const compact = t.replace(/\s+/g, '');

  if (compact.startsWith('+')) return compact.slice(0, 32);

  if (country === 'GB') {
    if (compact.startsWith('07')) return `+44${compact.slice(1)}`.slice(0, 32);
    if (compact.startsWith('7')) return `+44${compact}`.slice(0, 32);
    if (compact.startsWith('0044')) return `+44${compact.slice(4)}`.slice(0, 32);
  }

  return compact.slice(0, 32);
}

function parseKind(v: unknown): AddressKind {
  return v === 'BILLING' || v === 'BOTH' || v === 'SHIPPING' ? v : 'SHIPPING';
}

function prismaErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { code?: unknown };
  return typeof anyErr.code === 'string' ? anyErr.code : null;
}

function getIdempotencyKey(req: Request, bodyKey?: unknown) {
  const headerKey = req.headers.get('idempotency-key')?.trim();
  if (headerKey) return headerKey.slice(0, 128);

  if (typeof bodyKey === 'string') {
    const t = bodyKey.trim();
    if (t) return t.slice(0, 128);
  }

  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return json(false, { addresses: [] }, 200);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!user) return json(false, { addresses: [] }, 200);

  const addresses = await prisma.addressBook.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      label: true,
      isDefault: true,
      kind: true,
      firstName: true,
      lastName: true,
      line1: true,
      line2: true,
      town: true,
      city: true,
      postcode: true,
      country: true,
      phoneE164: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return json(true, { addresses }, 200);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return bad('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!user) return bad('Unauthorized', 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad('INVALID_JSON', 400);
  }

  const body = raw as Partial<{
    idempotencyKey: string;

    label: string;
    isDefault: boolean;
    kind: AddressKind;

    firstName: string | null;
    lastName: string | null;

    line1: string;
    line2: string | null;

    town: string | null;
    city: string;
    postcode: string;

    country: string;
    phoneE164: string | null;
  }>;

  // ✅ Idempotency: check for existing creation
  const idempotencyKey = getIdempotencyKey(req, body.idempotencyKey);

  if (idempotencyKey) {
    const existing = await prisma.addressBook.findFirst({
      where: { userId: user.id, idempotencyKey },
      select: {
        id: true,
        label: true,
        isDefault: true,
        kind: true,
        firstName: true,
        lastName: true,
        line1: true,
        line2: true,
        town: true,
        city: true,
        postcode: true,
        country: true,
        phoneE164: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (existing) {
      console.info('[addresses] idempotent hit', {
        userId: user.id,
        idempotencyKey
      });

      return json(true, { address: existing }, 200);
    }
  }

  const label = cleanRequired(body.label, 80);
  const line1 = cleanRequired(body.line1, 200);
  const city = cleanRequired(body.city, 120);
  const postcode = cleanRequired(body.postcode, 32);
  const country = normalizeCountry(body.country);

  if (!label) return bad('Label is required.', 400);
  if (!line1) return bad('Address line 1 is required.', 400);
  if (!city) return bad('Locality / City is required.', 400);
  if (!postcode) return bad('Postcode is required.', 400);
  if (!country) return bad('Country is required.', 400);

  const kind = parseKind(body.kind);
  const wantsDefault = body.isDefault === true;

  try {
    const created = await prisma.$transaction(async (tx: Tx) => {
      const existingCount = await tx.addressBook.count({ where: { userId: user.id } });
      const shouldDefault = wantsDefault || existingCount === 0;

      if (shouldDefault) {
        await tx.addressBook.updateMany({
          where: { userId: user.id },
          data: { isDefault: false }
        });
      }

      return tx.addressBook.create({
        data: {
          userId: user.id,
          label,
          isDefault: shouldDefault,
          kind,

          firstName: cleanOptional(body.firstName, 80),
          lastName: cleanOptional(body.lastName, 80),

          line1,
          line2: cleanOptional(body.line2, 200),

          town: cleanOptional(body.town, 120),
          city,
          postcode,
          country,
          phoneE164: normalizePhoneE164(body.phoneE164, country),

          // ✅ store idempotencyKey (optional)
          idempotencyKey: idempotencyKey ?? null
        },
        select: {
          id: true,
          label: true,
          isDefault: true,
          kind: true,
          firstName: true,
          lastName: true,
          line1: true,
          line2: true,
          town: true,
          city: true,
          postcode: true,
          country: true,
          phoneE164: true,
          createdAt: true,
          updatedAt: true
        }
      });
    });

    return json(true, { address: created }, 201);
  } catch (err) {
    if (prismaErrorCode(err) === 'P2002') {
      // label unique OR idempotency unique race
      if (idempotencyKey) {
        const existing = await prisma.addressBook.findFirst({
          where: { userId: user.id, idempotencyKey },
          select: {
            id: true,
            label: true,
            isDefault: true,
            kind: true,
            firstName: true,
            lastName: true,
            line1: true,
            line2: true,
            town: true,
            city: true,
            postcode: true,
            country: true,
            phoneE164: true,
            createdAt: true,
            updatedAt: true
          }
        });
        if (existing) return json(true, { address: existing }, 200);
      }

      return bad('You already have an address with this label. Choose a different label.', 409);
    }

    return bad('Could not create address.', 500);
  }
}
