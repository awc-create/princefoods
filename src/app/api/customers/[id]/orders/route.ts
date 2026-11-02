import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
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

    // 🔒 You may only read your own order history — unless you're admin staff.
    // Without this, passing any user id returned that customer's last 50 orders.
    const session = await getServerSession(authOptions);
    const viewer = session?.user as { id?: string; role?: string } | undefined;
    const isStaff =
      viewer?.role === 'HEAD' || viewer?.role === 'STAFF' || viewer?.role === 'VIEWER';

    if (!viewer?.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (viewer.id !== id && !isStaff) {
      return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    }

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
