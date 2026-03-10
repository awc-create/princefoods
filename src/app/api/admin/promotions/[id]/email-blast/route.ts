import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
}
const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function forbid() {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

type Scope = 'ALL_CUSTOMERS' | 'SELECTED_USERS';

function getUserIdFromSession(session: unknown): string | null {
  if (!session || typeof session !== 'object') return null;
  const s = session as { user?: unknown };
  if (!s.user || typeof s.user !== 'object') return null;
  const u = s.user as { id?: unknown };
  return typeof u.id === 'string' && u.id.trim() ? u.id : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role: Role | undefined = hasRole(session?.user)
      ? (session!.user.role ?? undefined)
      : undefined;

    if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

    const { id: promotionId } = await ctx.params;

    const body = (await req.json().catch(() => null)) as null | {
      scope?: Scope;
      userIds?: string[];
      subject?: string;
      message?: string | null;
    };

    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

    const scope: Scope = body.scope ?? 'SELECTED_USERS';
    const subject = (body.subject ?? '').trim();
    const message = typeof body.message === 'string' ? body.message.trim() : null;

    if (!subject) {
      return NextResponse.json({ ok: false, error: 'Subject is required.' }, { status: 400 });
    }

    const promo = await prisma.promotion.findUnique({
      where: { id: promotionId },
      select: { id: true, code: true }
    });

    if (!promo) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    if (!promo.code) {
      return NextResponse.json(
        { ok: false, error: 'Promotion has no code to email.' },
        { status: 400 }
      );
    }

    const userIds = Array.isArray(body.userIds) ? body.userIds.filter(Boolean) : [];

    if (scope === 'SELECTED_USERS' && userIds.length === 0) {
      return NextResponse.json({ ok: false, error: 'Select at least 1 user.' }, { status: 400 });
    }

    // ✅ Prisma: if email is non-nullable in schema, don't use { not: null }
    // Filter out empty emails instead.
    const userWhereBase = {
      deletedAt: null,
      email: { not: '' } // <- fix for your TS error
    } as const;

    const users =
      scope === 'ALL_CUSTOMERS'
        ? await prisma.user.findMany({
            where: userWhereBase,
            select: { id: true, email: true }
          })
        : await prisma.user.findMany({
            where: {
              ...userWhereBase,
              id: { in: userIds }
            },
            select: { id: true, email: true }
          });

    if (users.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No recipients found (missing emails?).' },
        { status: 400 }
      );
    }

    const createdById = getUserIdFromSession(session);

    const blast = await prisma.promotionEmailBlast.create({
      data: {
        promotionId,
        subject,
        message,
        // If your schema doesn't have createdById, remove this line.
        createdById
      },
      select: { id: true }
    });

    await prisma.promotionEmailBlastRecipient.createMany({
      data: users.map((u) => ({
        blastId: blast.id,
        userId: u.id,
        email: u.email,
        status: 'PENDING'
      })),
      skipDuplicates: true
    });

    // Kick off sending immediately (reuses your run route)
    const origin = new URL(req.url).origin;
    const runRes = await fetch(`${origin}/api/admin/promotions/blasts/${blast.id}/run?limit=500`, {
      method: 'POST',
      headers: {
        cookie: req.headers.get('cookie') ?? ''
      },
      cache: 'no-store'
    });

    const runJson = (await runRes.json().catch(() => null)) as unknown;

    return NextResponse.json({
      ok: true,
      blastId: blast.id,
      recipients: users.length,
      run: runJson
    });
  } catch (e) {
    console.error('[POST /api/admin/promotions/[id]/email-blast] error', e);
    return NextResponse.json({ ok: false, error: 'Failed to queue/send blast' }, { status: 500 });
  }
}
