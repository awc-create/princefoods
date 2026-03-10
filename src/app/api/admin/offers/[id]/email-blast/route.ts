import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF';
type Scope = 'ALL_CUSTOMERS' | 'SELECTED_USERS';

interface SessionUserWithRole {
  role?: Role | null;
}

const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function forbid() {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);

    const role: Role | undefined = hasRole(session?.user)
      ? (session.user.role ?? undefined)
      : undefined;

    if (!role) return forbid();

    const { id: offerId } = await ctx.params;

    const body = await req.json();

    const scope: Scope = body.scope ?? 'ALL_CUSTOMERS';
    const subject = (body.subject ?? '').trim();
    const message = typeof body.message === 'string' ? body.message.trim() : null;

    const userIds = Array.isArray(body.userIds) ? body.userIds : [];

    if (!subject) {
      return NextResponse.json({ ok: false, error: 'Subject required' }, { status: 400 });
    }

    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { id: true }
    });

    if (!offer) {
      return NextResponse.json({ ok: false, error: 'Offer not found' }, { status: 404 });
    }

    const customers =
      scope === 'ALL_CUSTOMERS'
        ? await prisma.user.findMany({
            where: {
              email: { not: '' },
              deletedAt: null,
              isAnonymized: false
            },
            select: { id: true, email: true }
          })
        : await prisma.user.findMany({
            where: {
              id: { in: userIds },
              email: { not: '' }
            },
            select: { id: true, email: true }
          });

    if (customers.length === 0) {
      return NextResponse.json({ ok: false, error: 'No recipients found' }, { status: 400 });
    }

    const blast = await prisma.offerEmailBlast.create({
      data: {
        offerId,
        subject,
        message,
        scope,
        userIds: scope === 'SELECTED_USERS' ? userIds : undefined,
        recipients: {
          createMany: {
            data: customers.map((c) => ({
              userId: c.id,
              email: c.email
            }))
          }
        }
      },
      select: { id: true }
    });

    const origin = new URL(req.url).origin;

    const runRes = await fetch(`${origin}/api/admin/offers/blasts/${blast.id}/run`, {
      method: 'POST',
      headers: {
        cookie: req.headers.get('cookie') ?? ''
      }
    });

    const runJson = await runRes.json().catch(() => null);

    return NextResponse.json({
      ok: true,
      blastId: blast.id,
      recipients: customers.length,
      run: runJson
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json({ ok: false, error: 'Failed to create blast' }, { status: 500 });
  }
}
