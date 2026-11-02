// src/app/api/account/messages/route.ts
/**
 * The signed-in customer's own questions and the answers to them.
 *
 * GET  — list them (and mark answered ones as read).
 * Scoped to the session user's id throughout: the caller never supplies an
 * id, so there is nothing to tamper with and no way to read someone else's
 * correspondence.
 */
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { safeError } from '@/lib/safe-error';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'no-store' };

/** Resolve the session to a user id, or null if not signed in. */
async function currentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email) return null;
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user?.id ?? null;
}

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthenticated', messages: [] },
        { status: 401, headers: noStore }
      );
    }

    const rows = await prisma.faqQuestion.findMany({
      where: { askerUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        question: true,
        answer: true,
        status: true,
        createdAt: true,
        answeredAt: true,
        readAt: true
      }
    });

    return NextResponse.json(
      {
        ok: true,
        messages: rows.map((r) => ({
          id: r.id,
          question: r.question,
          // Dismissed questions have no answer to show; presenting the
          // internal status to a customer would be noise at best.
          answer: r.status === 'ANSWERED' ? r.answer : null,
          askedAt: r.createdAt.getTime(),
          answeredAt: r.answeredAt?.getTime() ?? null,
          unread: r.status === 'ANSWERED' && r.readAt === null
        }))
      },
      { headers: noStore }
    );
  } catch (e) {
    const { message, code } = safeError(e, 'GET /api/account/messages');
    return NextResponse.json(
      { ok: false, error: message, code, messages: [] },
      { status: 500, headers: noStore }
    );
  }
}

/** Mark every answered message as read. Called when the tab is opened. */
export async function POST() {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }

    await prisma.faqQuestion.updateMany({
      where: { askerUserId: userId, status: 'ANSWERED', readAt: null },
      data: { readAt: new Date() }
    });

    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    const { message, code } = safeError(e, 'POST /api/account/messages');
    return NextResponse.json({ ok: false, error: message, code }, { status: 500 });
  }
}
