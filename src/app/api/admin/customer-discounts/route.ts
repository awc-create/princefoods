// src/app/api/admin/customer-discounts/route.ts
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

function computeStatus(startsAt: Date | null, endsAt: Date | null) {
  const now = new Date();
  const startOk = !startsAt || startsAt <= now;
  const endOk = !endsAt || endsAt >= now;

  if (startOk && endOk) return 'ACTIVE';
  if (startsAt && startsAt > now) return 'UPCOMING';
  return 'EXPIRED';
}

// ✅ ensures FK-safe createdByAdminId
async function resolveActorDbUserId(actorId: string | null, actorEmail: string | null) {
  if (actorId) {
    const byId = await prisma.user.findUnique({ where: { id: actorId }, select: { id: true } });
    if (byId?.id) return byId.id;
  }
  if (actorEmail) {
    const byEmail = await prisma.user.findUnique({
      where: { email: actorEmail },
      select: { id: true }
    });
    if (byEmail?.id) return byEmail.id;
  }
  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const role: Role | undefined = hasRole(session?.user)
    ? (session!.user.role ?? undefined)
    : undefined;
  if (!role || (role !== 'HEAD' && role !== 'STAFF')) return forbid();

  const rows = await prisma.customerDiscount.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: {
      user: { select: { id: true, email: true, name: true, firstName: true, lastName: true } }
    }
  });

  return NextResponse.json({
    ok: true,
    rows: rows.map((r) => {
      const label =
        (r.user?.name?.trim() ? r.user.name.trim() : '') ||
        [r.user?.firstName, r.user?.lastName].filter(Boolean).join(' ').trim() ||
        '' ||
        r.user?.email ||
        r.userId;

      const status = computeStatus(r.startsAt ?? null, r.endsAt ?? null);

      return {
        id: r.id,

        userId: r.userId,
        userLabel: label,
        userEmail: r.user?.email ?? '',

        percentOff: r.percentOff,
        applyShippingDiscount: r.applyShippingDiscount,
        shippingPercentOffDry: r.shippingPercentOffDry ?? null,
        shippingPercentOffFrozen: r.shippingPercentOffFrozen ?? null,

        startsAt: r.startsAt ? r.startsAt.toISOString() : null,
        endsAt: r.endsAt ? r.endsAt.toISOString() : null,

        note: r.note ?? null,

        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),

        status
      };
    })
  });
}

export async function POST(req: Request) {
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

  // ✅ FK-safe admin id (null if we can’t resolve)
  const createdByAdminId = await resolveActorDbUserId(actorId, actorEmail);

  const body = (await req.json().catch(() => null)) as null | {
    userIds?: string[];
    percentOff?: number;

    applyShippingDiscount?: boolean;
    shippingPercentOffDry?: number | null;
    shippingPercentOffFrozen?: number | null;

    startsAt?: string | null;
    endsAt?: string | null;

    note?: string | null;
  };

  if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });

  const userIds = Array.isArray(body.userIds)
    ? body.userIds.map((x) => x.trim()).filter(Boolean)
    : [];
  if (userIds.length === 0) {
    return NextResponse.json({ ok: false, error: 'Select at least 1 customer.' }, { status: 400 });
  }

  const pct = typeof body.percentOff === 'number' ? clampPct(body.percentOff) : NaN;
  if (!Number.isFinite(pct)) {
    return NextResponse.json(
      { ok: false, error: 'percentOff is required (1–100).' },
      { status: 400 }
    );
  }

  const applyShip = body.applyShippingDiscount === true;
  const shipDry =
    applyShip && typeof body.shippingPercentOffDry === 'number'
      ? clampShipPct(body.shippingPercentOffDry)
      : null;
  const shipFrozen =
    applyShip && typeof body.shippingPercentOffFrozen === 'number'
      ? clampShipPct(body.shippingPercentOffFrozen)
      : null;

  const startsAt = toDateOrNull(body.startsAt ?? null);
  const endsAt = toDateOrNull(body.endsAt ?? null);
  if (startsAt && endsAt && endsAt < startsAt) {
    return NextResponse.json(
      { ok: false, error: 'endsAt must be after startsAt.' },
      { status: 400 }
    );
  }

  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;

  const created = await prisma.$transaction(async (tx) => {
    const createdRows = await Promise.all(
      userIds.map(async (userId) => {
        const row = await tx.customerDiscount.create({
          data: {
            userId,
            // ✅ this is what was breaking the FK
            createdByAdminId: createdByAdminId ?? undefined,

            percentOff: pct,
            applyShippingDiscount: applyShip,
            shippingPercentOffDry: applyShip ? shipDry : null,
            shippingPercentOffFrozen: applyShip ? shipFrozen : null,
            startsAt: startsAt ?? undefined,
            endsAt: endsAt ?? undefined,
            note: note ?? undefined
          }
        });

        await tx.userAudit.create({
          data: {
            userId,
            actorId,
            actorEmail,
            action: 'CREATE',
            reason: 'CUSTOMER_DISCOUNT',
            before: Prisma.DbNull,
            after: {
              id: row.id,
              createdByAdminId: row.createdByAdminId ?? null,
              percentOff: row.percentOff,
              applyShippingDiscount: row.applyShippingDiscount,
              shippingPercentOffDry: row.shippingPercentOffDry,
              shippingPercentOffFrozen: row.shippingPercentOffFrozen,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              note: row.note
            }
          }
        });

        return row;
      })
    );

    return createdRows;
  });

  return NextResponse.json({ ok: true, createdCount: created.length });
}
