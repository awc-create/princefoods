import { prisma } from '@/lib/prisma';
import { getParams } from '@/lib/route-ctx';
import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function formatGBP(pence: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((pence ?? 0) / 100);
}

export async function GET(_req: NextRequest, ctx: unknown) {
  try {
    const { id } = getParams<{ id: string }>(ctx);

    // Ensure the customer exists — get email for fallback matching
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true }
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

    // ✅ Explicitly type the OR parts so both userId and contactEmail are valid
    const orParts: Prisma.OrderWhereInput[] = [{ userId: user.id }];
    if (user.email) {
      orParts.push({ contactEmail: user.email });
    }

    const orders = await prisma.order.findMany({
      where: { OR: orParts },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        displayId: true,
        createdAt: true,
        status: true,
        grandTotal: true,
        _count: { select: { items: true } },
        userId: true,
        contactEmail: true
      }
    });

    const items = orders.map((o) => ({
      id: o.id,
      number: o.displayId ?? o.id,
      date: new Date(o.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }),
      items: String(o._count.items),
      total: formatGBP(o.grandTotal, 'GBP'),
      status: o.status
    }));

    const ownedCount = orders.filter((o) => o.userId === user.id).length;
    const emailCount = user.email
      ? orders.filter((o) => o.userId !== user.id && o.contactEmail === user.email).length
      : 0;

    let note: string | null = null;
    if (ownedCount === 0 && emailCount > 0) {
      note = `Showing orders matched by email (${user.email}).`;
    } else if (emailCount > 0) {
      note = `Includes ${emailCount} order(s) matched by email (${user.email}).`;
    }

    return NextResponse.json({ ok: true, items, note });
  } catch (err) {
    console.error('GET /api/customers/[id]/orders failed:', err);
    return NextResponse.json({ ok: false, error: 'ORDERS_LIST_FAILED' }, { status: 500 });
  }
}
