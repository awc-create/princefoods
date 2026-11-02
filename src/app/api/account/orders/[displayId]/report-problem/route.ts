// src/app/api/account/orders/[displayId]/report-problem/route.ts
/**
 * Customer-initiated "something's wrong with my order".
 *
 * Until now every ReturnCase was opened by staff — a customer whose frozen
 * order arrived thawed had no route into the system at all and had to find the
 * contact form. This opens the same ReturnCase the admin tooling already
 * handles (decide / receive / reship / refund), so nothing new is needed on the
 * admin side.
 *
 * Ownership is enforced: you can only report a problem on your own order.
 */
import { authOptions } from '@/lib/auth-options';
import { logActivity } from '@/lib/order-activity';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What the customer can report, mapped onto the existing DeliveryIssueType. */
const ISSUE_MAP = {
  DAMAGED: 'DAMAGED',
  MISSING: 'UNKNOWN',
  NOT_DELIVERED: 'DELIVERY_FAILED',
  WRONG_ITEM: 'UNKNOWN',
  OTHER: 'UNKNOWN'
} as const;

export type CustomerIssue = keyof typeof ISSUE_MAP;

const ISSUE_LABEL: Record<CustomerIssue, string> = {
  DAMAGED: 'Item arrived damaged',
  MISSING: 'Item missing from order',
  NOT_DELIVERED: 'Order never arrived',
  WRONG_ITEM: 'Wrong item sent',
  OTHER: 'Other problem'
};

const MAX_NOTE = 1000;

export async function POST(req: Request, ctx: { params: Promise<{ displayId: string }> }) {
  try {
    const { displayId } = await ctx.params;

    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | null)?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Please sign in first.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as { issue?: string; note?: string };

    const issue = (body.issue ?? '') as CustomerIssue;
    if (!(issue in ISSUE_MAP)) {
      return NextResponse.json(
        { ok: false, error: 'Please choose what went wrong.' },
        { status: 400 }
      );
    }

    const note = String(body.note ?? '')
      .trim()
      .slice(0, MAX_NOTE);

    // 🔒 ownership — same pattern as the other /api/account routes
    const order = await prisma.order.findFirst({
      where: { displayId, userId },
      select: { id: true, displayId: true }
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 });
    }

    const existing = await prisma.returnCase.findUnique({
      where: { orderId: order.id },
      select: { id: true, status: true }
    });

    if (existing && existing.status !== 'RESOLVED') {
      return NextResponse.json({
        ok: true,
        alreadyOpen: true,
        message: "You've already reported a problem with this order — we're on it."
      });
    }

    const summary = `${ISSUE_LABEL[issue]}${note ? ` — ${note}` : ''}`;

    await prisma.returnCase.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        status: 'OPEN',
        issueType: ISSUE_MAP[issue],
        detectedAt: new Date(),
        meta: { source: 'customer', issue, note: note || null }
      },
      update: {
        status: 'OPEN',
        issueType: ISSUE_MAP[issue],
        resolution: null,
        resolutionNote: null,
        resolvedAt: null,
        detectedAt: new Date(),
        meta: { source: 'customer', issue, note: note || null }
      }
    });

    // Shows up in the order's activity timeline for staff.
    await logActivity(order.id, 'NOTE', `Customer reported a problem: ${summary}`);

    return NextResponse.json({
      ok: true,
      message: "Thanks — we've logged this and will be in touch shortly."
    });
  } catch (e) {
    console.error('[report-problem]', e);
    return NextResponse.json(
      { ok: false, error: 'Could not submit that just now. Please try again.' },
      { status: 500 }
    );
  }
}
