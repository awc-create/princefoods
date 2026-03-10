import { authOptions } from '@/lib/auth-options';
import { sendOfferEmail } from '@/lib/email';
import { buildOfferEmailPresentation, isOfferPayload } from '@/lib/offers/offer-email-targeting';
import { summarizeOffer } from '@/lib/offers/offer-payload';
import { prisma } from '@/lib/prisma';
import type { OfferPayload } from '@/types/offers';
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

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>
) {
  const queue = [...items];
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function POST(req: Request, ctx: { params: Promise<{ blastId: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role: Role | undefined = hasRole(session?.user)
      ? (session.user.role ?? undefined)
      : undefined;

    if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

    const url = new URL(req.url);
    const limitRaw = Number(url.searchParams.get('limit') ?? '100');
    const limit = Math.max(
      1,
      Math.min(500, Number.isFinite(limitRaw) ? Math.trunc(limitRaw) : 100)
    );

    const { blastId } = await ctx.params;

    const blast = await prisma.offerEmailBlast.findUnique({
      where: { id: blastId },
      select: {
        id: true,
        subject: true,
        message: true,
        startedAt: true,
        finishedAt: true,
        offer: {
          select: {
            id: true,
            name: true,
            payload: true
          }
        }
      }
    });

    if (!blast) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    if (!isOfferPayload(blast.offer.payload)) {
      return NextResponse.json({ ok: false, error: 'Offer payload is invalid.' }, { status: 400 });
    }

    const payload: OfferPayload = blast.offer.payload;

    if (blast.finishedAt) {
      return NextResponse.json({ ok: true, done: true, message: 'Blast already finished.' });
    }

    if (!blast.startedAt) {
      await prisma.offerEmailBlast.update({
        where: { id: blastId },
        data: { startedAt: new Date() }
      });
    }

    const batch = await prisma.offerEmailBlastRecipient.findMany({
      where: { blastId, status: 'PENDING' },
      take: limit,
      select: {
        id: true,
        email: true,
        user: {
          select: {
            name: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });

    if (batch.length === 0) {
      await prisma.offerEmailBlast.update({
        where: { id: blastId },
        data: { finishedAt: new Date() }
      });

      return NextResponse.json({ ok: true, done: true, sent: 0, failed: 0 });
    }

    const presentation = await buildOfferEmailPresentation(prisma, payload);
    const { headline } = summarizeOffer(payload);

    let sent = 0;
    let failed = 0;

    await runWithConcurrency(batch, 6, async (r) => {
      const name =
        `${(r.user?.firstName ?? '').trim()} ${(r.user?.lastName ?? '').trim()}`.trim() ||
        (r.user?.name ?? '').trim() ||
        null;

      try {
        const out = await sendOfferEmail({
          to: r.email,
          name,
          title: blast.subject,
          message: blast.message ?? null,
          offerHeadline: headline,
          sectionTitle: presentation.sectionTitle,
          products: presentation.products,
          ctaLabel: presentation.ctaLabel,
          ctaHref: presentation.ctaHref
        });

        await prisma.offerEmailBlastRecipient.update({
          where: { id: r.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            resendId: out.id
          }
        });

        sent += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Send failed';

        await prisma.offerEmailBlastRecipient.update({
          where: { id: r.id },
          data: {
            status: 'FAILED',
            error: msg
          }
        });

        failed += 1;
      }
    });

    await prisma.offerEmailBlast.update({
      where: { id: blastId },
      data: {
        sentCount: { increment: sent },
        failedCount: { increment: failed }
      }
    });

    const remaining = await prisma.offerEmailBlastRecipient.count({
      where: { blastId, status: 'PENDING' }
    });

    if (remaining === 0) {
      await prisma.offerEmailBlast.update({
        where: { id: blastId },
        data: { finishedAt: new Date() }
      });
    }

    return NextResponse.json({
      ok: true,
      done: remaining === 0,
      sent,
      failed,
      remaining
    });
  } catch (e) {
    console.error('[POST /api/admin/offers/blasts/[blastId]/run] error', e);
    return NextResponse.json({ ok: false, error: 'Failed to run offer blast' }, { status: 500 });
  }
}
