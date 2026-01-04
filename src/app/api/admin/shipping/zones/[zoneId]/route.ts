// src/app/api/admin/shipping/zones/[zoneId]/route.ts
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

export async function PATCH(req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const { zoneId } = await ctx.params;

  const body = (await req.json()) as {
    name?: string;
    priority?: number;
    isActive?: boolean;
    notes?: string | null;
  };

  const updated = await prisma.shippingZone.update({
    where: { id: zoneId },
    data: {
      ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
      ...(typeof body.priority === 'number' ? { priority: Math.trunc(body.priority) } : {}),
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      ...(typeof body.notes === 'string'
        ? { notes: body.notes }
        : body.notes === null
          ? { notes: null }
          : {})
    }
  });

  return NextResponse.json({ ok: true, zone: updated });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ zoneId: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | null)?.role;
  if (!isAdminRole(role)) return bad('Unauthorized', 401);

  const { zoneId } = await ctx.params;

  await prisma.shippingZone.delete({ where: { id: zoneId } });
  return NextResponse.json({ ok: true });
}
