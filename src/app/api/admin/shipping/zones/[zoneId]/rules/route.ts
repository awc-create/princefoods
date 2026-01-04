// src/app/api/admin/shipping/zones/[zoneId]/rules/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function isAdminRole(role?: string) {
  return role === 'HEAD' || role === 'STAFF';
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const { zoneId } = await ctx.params;

  const body = (await req.json()) as {
    countryCode?: string;
    postcodePrefix?: string | null;
    postcodeRegex?: string | null;
  };

  const countryCode =
    typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : '';

  if (!countryCode) return bad('countryCode is required.');

  const postcodePrefix =
    typeof body.postcodePrefix === 'string' && body.postcodePrefix.trim()
      ? body.postcodePrefix.trim().toUpperCase()
      : null;

  const postcodeRegex =
    typeof body.postcodeRegex === 'string' && body.postcodeRegex.trim()
      ? body.postcodeRegex.trim()
      : null;

  // Validate regex early so bad configs don’t break quoting
  if (postcodeRegex) {
    try {
      new RegExp(postcodeRegex, 'i');
    } catch {
      return bad('Invalid postcodeRegex');
    }
  }

  const created = await prisma.shippingZoneRule.create({
    data: {
      zoneId,
      countryCode,
      postcodePrefix,
      postcodeRegex
    }
  });

  return NextResponse.json({ ok: true, rule: created });
}
