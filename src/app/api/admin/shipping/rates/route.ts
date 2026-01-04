// src/app/api/admin/shipping/rates/route.ts
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const body = (await req.json()) as {
    zoneId?: string;
    temp?: 'DRY' | 'FROZEN';
    service?: 'STANDARD' | 'EXPRESS';
    currency?: string;
    freeOverPence?: number | null;
  };

  const zoneId = typeof body.zoneId === 'string' ? body.zoneId : '';
  if (!zoneId) return bad('zoneId is required.');

  const temp = body.temp === 'FROZEN' ? 'FROZEN' : 'DRY';
  const service = body.service === 'EXPRESS' ? 'EXPRESS' : 'STANDARD';
  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'GBP';

  const created = await prisma.shippingRate.create({
    data: {
      zoneId,
      temp,
      service,
      currency,
      freeOverPence:
        typeof body.freeOverPence === 'number' ? Math.max(0, Math.trunc(body.freeOverPence)) : null
    }
  });

  return NextResponse.json({ ok: true, rate: created });
}
