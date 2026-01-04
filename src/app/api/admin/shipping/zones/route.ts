// src/app/api/admin/shipping/zones/route.ts
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

export async function GET() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const zones = await prisma.shippingZone.findMany({
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    include: {
      rules: { orderBy: [{ createdAt: 'asc' }] },
      rates: {
        orderBy: [{ createdAt: 'asc' }],
        include: { tiers: { orderBy: [{ minGramsExclusive: 'asc' }] } }
      }
    }
  });

  return NextResponse.json({ ok: true, zones });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const body = (await req.json()) as {
    name?: string;
    priority?: number;
    isActive?: boolean;
    notes?: string;
  };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return bad('Name is required.');

  const created = await prisma.shippingZone.create({
    data: {
      name,
      priority: typeof body.priority === 'number' ? Math.trunc(body.priority) : 0,
      isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
      notes: typeof body.notes === 'string' ? body.notes : null
    }
  });

  return NextResponse.json({ ok: true, zone: created });
}
