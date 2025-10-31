import { logUserAudit } from '@/lib/audit';
import { authOptions } from '@/lib/auth-options';
import { createNotification } from '@/lib/notify';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

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

export async function POST(req: NextRequest, ctx: unknown) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Partial<{ role: Role }> | undefined)?.role ?? null;
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'HEAD' && role !== 'STAFF') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await getParams<{ id: string }>(ctx);
  const { note } = (await req.json().catch(() => ({}))) as { note?: string };

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();
  const after = await prisma.user.update({
    where: { id },
    data: {
      deletedAt: now,
      restrictedAt: now,
      deletionReason: 'Restricted by admin',
      restrictionNote: note?.trim() ?? null
    }
  });

  await logUserAudit({
    userId: id,
    action: 'RESTRICT',
    before,
    after,
    reason: 'Manual restriction'
  });

  await createNotification({
    kind: 'customer_restricted',
    title: 'Customer restricted',
    body: `User ${before.name ?? before.email ?? id} has been restricted by ${
      (session?.user as { name?: string })?.name ?? 'an admin'
    }.`,
    link: `/admin/customers/${id}`,
    meta: { userId: id, note: note?.trim() ?? null }
  });

  return NextResponse.json({ ok: true, user: after });
}
