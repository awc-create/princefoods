// src/app/api/admin/promotions/blasts/[blastId]/route.ts
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

export async function GET(_req: Request, ctx: { params: Promise<{ blastId: string }> }) {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const { blastId } = await ctx.params;

  const blast = await prisma.promotionEmailBlast.findUnique({
    where: { id: blastId },
    select: {
      id: true,
      promotionId: true,
      scope: true,
      subject: true,
      message: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      plannedCount: true,
      sentCount: true,
      failedCount: true,
      _count: {
        select: { recipients: true }
      }
    }
  });

  if (!blast) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const pending = await prisma.promotionEmailBlastRecipient.count({
    where: { blastId, status: 'PENDING' }
  });

  return NextResponse.json({
    ok: true,
    blast: {
      ...blast,
      createdAt: blast.createdAt.toISOString(),
      startedAt: blast.startedAt ? blast.startedAt.toISOString() : null,
      finishedAt: blast.finishedAt ? blast.finishedAt.toISOString() : null,
      pendingCount: pending
    }
  });
}
