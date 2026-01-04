// src/app/api/account/addresses/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

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

function parseKind(v: unknown): AddressKind | null {
  if (v === undefined) return null;
  return v === 'BILLING' || v === 'BOTH' || v === 'SHIPPING' ? v : null;
}

function prismaErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const anyErr = err as { code?: unknown };
  return typeof anyErr.code === 'string' ? anyErr.code : null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return bad('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!user) return bad('Unauthorized', 401);

  const existing = await prisma.addressBook.findUnique({
    where: { id },
    select: { id: true, userId: true, country: true, isDefault: true }
  });
  if (!existing || existing.userId !== user.id) return bad('Not found', 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad('INVALID_JSON', 400);
  }

  const body = raw as Partial<{
    isDefault: boolean;

    label: string;
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

  const wantsDefault = body.isDefault === true;

  const data: Record<string, unknown> = {};

  if (typeof body.label === 'string') {
    const label = cleanRequired(body.label, 80);
    if (!label) return bad('Label is required.', 400);
    data.label = label;
  }

  const parsedKind = parseKind(body.kind);
  if (parsedKind) data.kind = parsedKind;

  if (body.firstName !== undefined) data.firstName = cleanOptional(body.firstName, 80);
  if (body.lastName !== undefined) data.lastName = cleanOptional(body.lastName, 80);

  if (typeof body.line1 === 'string') {
    const line1 = cleanRequired(body.line1, 200);
    if (!line1) return bad('Address line 1 is required.', 400);
    data.line1 = line1;
  }
  if (body.line2 !== undefined) data.line2 = cleanOptional(body.line2, 200);

  // “Town” is Post Town (UK) in your UI, but still optional
  if (body.town !== undefined) data.town = cleanOptional(body.town, 120);

  if (typeof body.city === 'string') {
    const city = cleanRequired(body.city, 120);
    if (!city) return bad('Locality / City is required.', 400);
    data.city = city;
  }

  if (typeof body.postcode === 'string') {
    const postcode = cleanRequired(body.postcode, 32);
    if (!postcode) return bad('Postcode is required.', 400);
    data.postcode = postcode;
  }

  // country affects phone normalization
  const nextCountry =
    body.country !== undefined
      ? normalizeCountry(body.country)
      : normalizeCountry(existing.country);

  if (body.country !== undefined) data.country = nextCountry;

  if (body.phoneE164 !== undefined) {
    data.phoneE164 = normalizePhoneE164(body.phoneE164, nextCountry);
  }

  // No-op safeguard: if they send empty PATCH (and not setting default), return current
  const hasChanges = Object.keys(data).length > 0;

  try {
    const updated = await prisma.$transaction(async (tx: Tx) => {
      // ✅ Setting default should never leave you with 0 defaults
      if (wantsDefault) {
        // If already default, skip the updateMany to reduce churn
        if (!existing.isDefault) {
          await tx.addressBook.updateMany({
            where: { userId: user.id },
            data: { isDefault: false }
          });
        }
        data.isDefault = true;
      }

      // If nothing to update AND not changing default: return current record details
      if (!wantsDefault && !hasChanges) {
        const current = await tx.addressBook.findUnique({
          where: { id },
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
        if (!current) throw new Error('NOT_FOUND');
        return current;
      }

      return tx.addressBook.update({
        where: { id },
        data,
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

    return json(true, { address: updated }, 200);
  } catch (err) {
    if ((err as Error)?.message === 'NOT_FOUND') return bad('Not found', 404);

    if (prismaErrorCode(err) === 'P2002') {
      return bad('You already have an address with this label. Choose a different label.', 409);
    }
    return bad('Could not update address.', 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return bad('Unauthorized', 401);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });
  if (!user) return bad('Unauthorized', 401);

  const existing = await prisma.addressBook.findUnique({
    where: { id },
    select: { id: true, userId: true, isDefault: true }
  });
  if (!existing || existing.userId !== user.id) return bad('Not found', 404);

  await prisma.$transaction(async (tx: Tx) => {
    await tx.addressBook.delete({ where: { id } });

    // ✅ If they deleted the default, promote newest remaining to default
    if (existing.isDefault) {
      const next = await tx.addressBook.findFirst({
        where: { userId: user.id },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        select: { id: true }
      });
      if (next) {
        await tx.addressBook.update({
          where: { id: next.id },
          data: { isDefault: true }
        });
      }
    }

    // ✅ Extra safety: if any reason we ended up with addresses but no default, repair it.
    const remainingCount = await tx.addressBook.count({ where: { userId: user.id } });
    if (remainingCount > 0) {
      const hasDefault = await tx.addressBook.findFirst({
        where: { userId: user.id, isDefault: true },
        select: { id: true }
      });

      if (!hasDefault) {
        const promote = await tx.addressBook.findFirst({
          where: { userId: user.id },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          select: { id: true }
        });

        if (promote) {
          await tx.addressBook.update({
            where: { id: promote.id },
            data: { isDefault: true }
          });
        }
      }
    }
  });

  return json(true, {}, 200);
}
