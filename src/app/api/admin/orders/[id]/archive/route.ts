// src/app/api/admin/orders/[id]/archive/route.ts
import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// src/app/api/admin/orders/[id]/archive/route.ts
// ...
export async function POST(_req: NextRequest, _ctx: unknown) {
  const guard = await requireAdmin({ write: true });
  if (!guard.ok) return guard.response;

  const { id } = getParams(_ctx);
  try {
    const order = await prisma.order.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true }
    });
    await prisma.orderActivity.create({
      data: { orderId: order.id, type: 'NOTE', note: 'Archived' }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'ARCHIVE_FAILED' }, { status: 500 });
  }
}
