// src/app/api/customers/[id]/route.ts
import { logUserAudit } from '@/lib/audit';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type WelcomeStatus = 'PENDING' | 'SENT' | 'COMPLETED';

// PromiseLike type guard (no `any`)
function isPromiseLike<T = unknown>(v: unknown): v is PromiseLike<T> {
  return (
    typeof v === 'object' && v !== null && typeof (v as { then?: unknown }).then === 'function'
  );
}
async function getParams<T extends Record<string, unknown>>(ctx: unknown): Promise<T> {
  const raw = (ctx as { params?: unknown })?.params;
  if (isPromiseLike<T>(raw)) return await raw;
  return (raw ?? {}) as T;
}

async function currentRole(): Promise<Role | null> {
  const s = await getServerSession(authOptions);
  return (s?.user as Partial<{ role: Role }> | undefined)?.role ?? null;
}
function needRole(allowed: Role[], role: Role | null) {
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return null;
}

export async function GET(_: NextRequest, ctx: unknown) {
  const { id } = await getParams<{ id: string }>(ctx);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phoneRaw: true,
      role: true,
      source: true,
      welcomeStatus: true,
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      restrictionNote: true,
      deletionReason: true,
      isAnonymized: true,
      anonymizedAt: true
    }
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [threadsById, threadsByEmail] = await Promise.all([
    prisma.chatThread.findMany({
      where: { userKey: user.id },
      orderBy: { createdAt: 'asc' }, // we take latest via messages, so order isn't critical
      take: 10,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
    }),
    prisma.chatThread.findMany({
      where: { customerEmail: user.email },
      orderBy: { createdAt: 'asc' },
      take: 10,
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } }
    })
  ]);

  const threads = [...threadsById, ...threadsByEmail]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  const conversations = threads.length;
  const lastInteraction = threads[0]
    ? new Date(
        Math.max(threads[0].lastUserAt?.getTime() ?? 0, threads[0].lastAdminAt?.getTime() ?? 0)
      ).toLocaleString()
    : null;

  return NextResponse.json({
    contact: user,
    stats: { conversations, lastInteraction },
    recentThreads: threads.map((t) => ({
      id: t.id,
      status: t.status,
      createdAt: t.createdAt,
      lastUserAt: t.lastUserAt,
      lastAdminAt: t.lastAdminAt,
      lastMessagePreview: t.messages[0]?.content?.slice(0, 140) || ''
    }))
  });
}

export async function PATCH(req: NextRequest, ctx: unknown) {
  const role = await currentRole();
  const forbid = needRole(['HEAD', 'STAFF'], role);
  if (forbid) return forbid;

  const { id } = await getParams<{ id: string }>(ctx);
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    phone?: string;
    role?: Role;
    welcomeStatus?: WelcomeStatus;
  };

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.trim();

  if (typeof body.email === 'string') {
    const e = body.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }
    // lock email for WIX source if desired
    if (before.source !== 'WIX') updates.email = e;
  }

  if (typeof body.phone === 'string') updates.phoneRaw = body.phone.trim();

  if (body.role && ['HEAD', 'STAFF', 'VIEWER'].includes(body.role)) {
    if (role !== 'HEAD' && body.role !== 'VIEWER') {
      return NextResponse.json({ error: 'Only HEAD may assign STAFF/HEAD' }, { status: 403 });
    }
    updates.role = body.role;
  }

  if (body.welcomeStatus && ['PENDING', 'SENT', 'COMPLETED'].includes(body.welcomeStatus)) {
    updates.welcomeStatus = body.welcomeStatus;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const after = await prisma.user.update({ where: { id }, data: updates });
    await logUserAudit({ userId: id, action: 'UPDATE', before, after });
    return NextResponse.json({ contact: after });
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, ctx: unknown) {
  // Default: anonymize instead of hard delete (HEAD-only)
  const role = await currentRole();
  const forbid = needRole(['HEAD'], role);
  if (forbid) return forbid;

  const { id } = await getParams<{ id: string }>(ctx);

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const stamp = Date.now();
    const placeholder = `deleted_${id}_${stamp}@example.invalid`;
    const after = await prisma.user.update({
      where: { id },
      data: {
        name: 'Deleted User',
        email: placeholder,
        phoneRaw: null,
        isAnonymized: true,
        anonymizedAt: new Date(),
        deletedAt: new Date(), // also restricted
        restrictedAt: new Date(),
        role: 'VIEWER',
        deletionReason: 'Anonymized via DELETE'
      }
    });
    await logUserAudit({
      userId: id,
      action: 'ANONYMIZE',
      before,
      after,
      reason: 'DELETE endpoint'
    });
    return NextResponse.json({ ok: true, anonymized: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to anonymize' }, { status: 500 });
  }
}
