// src/app/api/admin/customer-discounts/[id]/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUserWithRole {
  role?: Role | null;
  email?: string | null;
  id?: string | null;
}

const hasRole = (u: unknown): u is SessionUserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function forbid() {
  return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
}

function clampPct(n: number) {
  return Math.max(1, Math.min(100, Math.trunc(n)));
}

function clampShipPct(n: number) {
  return Math.max(0, Math.min(100, Math.trunc(n)));
}

function toDateOrNull(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role: Role | undefined = hasRole(session?.user)
      ? (session!.user.role ?? undefined)
      : undefined;
    if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

    const actorId = hasRole(session?.user)
      ? ((session?.user as SessionUserWithRole).id ?? null)
      : null;
    const actorEmail = hasRole(session?.user)
      ? ((session?.user as SessionUserWithRole).email ?? null)
      : null;

    const { id } = await ctx.params;

    const existing = await prisma.customerDiscount.findUnique({
      where: { id }
    });
    if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    const body = (await req.json().catch(() => null)) as null | Partial<{
      percentOff: number;

      applyShippingDiscount: boolean;
      shippingPercentOffDry: number | null;
      shippingPercentOffFrozen: number | null;

      startsAt: string | null;
      endsAt: string | null;

      note: string | null;

      revokedAt: string | null;
      revokeReason: string | null;
    }>;

    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

    const data: Record<string, unknown> = {};

    if ('percentOff' in body && typeof body.percentOff === 'number') {
      data.percentOff = clampPct(body.percentOff);
    }

    const hasApplyShip = 'applyShippingDiscount' in body;
    const hasShipDry = 'shippingPercentOffDry' in body;
    const hasShipFrozen = 'shippingPercentOffFrozen' in body;

    if (hasApplyShip) {
      const apply = body.applyShippingDiscount === true;
      data.applyShippingDiscount = apply;
      if (!apply) {
        data.shippingPercentOffDry = null;
        data.shippingPercentOffFrozen = null;
      }
    }

    const applyFinal =
      'applyShippingDiscount' in body
        ? body.applyShippingDiscount === true
        : existing.applyShippingDiscount === true;

    if (applyFinal) {
      if (hasShipDry) {
        data.shippingPercentOffDry =
          body.shippingPercentOffDry == null ? null : clampShipPct(body.shippingPercentOffDry);
      }
      if (hasShipFrozen) {
        data.shippingPercentOffFrozen =
          body.shippingPercentOffFrozen == null
            ? null
            : clampShipPct(body.shippingPercentOffFrozen);
      }
    }

    if ('startsAt' in body) data.startsAt = body.startsAt ? toDateOrNull(body.startsAt) : null;
    if ('endsAt' in body) data.endsAt = body.endsAt ? toDateOrNull(body.endsAt) : null;

    const startsAt =
      'startsAt' in data ? (data.startsAt as Date | null) : (existing.startsAt ?? null);
    const endsAt = 'endsAt' in data ? (data.endsAt as Date | null) : (existing.endsAt ?? null);
    if (startsAt && endsAt && endsAt < startsAt) {
      return NextResponse.json(
        { ok: false, error: 'endsAt must be after startsAt.' },
        { status: 400 }
      );
    }

    if ('note' in body) data.note = (body.note ?? '').trim() || null;

    if ('revokedAt' in body) data.revokedAt = body.revokedAt ? toDateOrNull(body.revokedAt) : null;
    if ('revokeReason' in body) data.revokeReason = (body.revokeReason ?? '').trim() || null;

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.customerDiscount.update({ where: { id }, data });

      await tx.userAudit.create({
        data: {
          userId: existing.userId,
          actorId,
          actorEmail,
          action: 'UPDATE',
          reason: 'CUSTOMER_DISCOUNT',
          before: {
            id: existing.id,
            percentOff: existing.percentOff,
            applyShippingDiscount: existing.applyShippingDiscount,
            shippingPercentOffDry: existing.shippingPercentOffDry,
            shippingPercentOffFrozen: existing.shippingPercentOffFrozen,
            startsAt: existing.startsAt,
            endsAt: existing.endsAt,
            revokedAt: existing.revokedAt,
            revokeReason: existing.revokeReason,
            note: existing.note
          },
          after: {
            id: row.id,
            percentOff: row.percentOff,
            applyShippingDiscount: row.applyShippingDiscount,
            shippingPercentOffDry: row.shippingPercentOffDry,
            shippingPercentOffFrozen: row.shippingPercentOffFrozen,
            startsAt: row.startsAt,
            endsAt: row.endsAt,
            revokedAt: row.revokedAt,
            revokeReason: row.revokeReason,
            note: row.note
          }
        }
      });

      return row;
    });

    return NextResponse.json({ ok: true, row: updated });
  } catch (err) {
    console.error('PATCH /api/admin/customer-discounts/[id] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const role: Role | undefined = hasRole(session?.user)
      ? (session!.user.role ?? undefined)
      : undefined;
    if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

    const actorId = hasRole(session?.user)
      ? ((session?.user as SessionUserWithRole).id ?? null)
      : null;
    const actorEmail = hasRole(session?.user)
      ? ((session?.user as SessionUserWithRole).email ?? null)
      : null;

    const { id } = await ctx.params;

    const existing = await prisma.customerDiscount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      await tx.userAudit.create({
        data: {
          userId: existing.userId,
          actorId,
          actorEmail,
          action: 'HARD_DELETE',
          reason: 'CUSTOMER_DISCOUNT',
          before: {
            id: existing.id,
            percentOff: existing.percentOff,
            applyShippingDiscount: existing.applyShippingDiscount,
            shippingPercentOffDry: existing.shippingPercentOffDry,
            shippingPercentOffFrozen: existing.shippingPercentOffFrozen,
            startsAt: existing.startsAt,
            endsAt: existing.endsAt,
            revokedAt: existing.revokedAt,
            revokeReason: existing.revokeReason,
            note: existing.note
          },
          after: Prisma.DbNull
        }
      });

      await tx.customerDiscount.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/customer-discounts/[id] failed:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
