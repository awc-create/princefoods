import { logUserAudit } from '@/lib/audit';
import { authOptions } from '@/lib/auth-options';
import { createNotification } from '@/lib/notify';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

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

export async function POST(_: NextRequest, ctx: unknown) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Partial<{ role: Role }> | undefined)?.role ?? null;
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'HEAD' && role !== 'STAFF') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await getParams<{ id: string }>(ctx);

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Generate a placeholder email to avoid unique collisions
  const stamp = Date.now();
  const placeholderEmail = `anonymized_${id}_${stamp}@example.invalid`;

  const after = await prisma.user.update({
    where: { id },
    data: {
      name: 'Deleted User',
      email: placeholderEmail,
      phoneRaw: null,
      isAnonymized: true,
      anonymizedAt: new Date(),
      deletedAt: new Date(),
      restrictedAt: new Date(),
      role: 'VIEWER',
      deletionReason: 'Anonymized by admin'
    }
  });

  await logUserAudit({
    userId: id,
    action: 'ANONYMIZE',
    before,
    after,
    reason: 'Manual anonymize endpoint'
  });

  await createNotification({
    kind: 'customer_anonymized',
    title: `Customer anonymized`,
    body: `User ${before.name ?? before.email ?? id} has been anonymized by ${
      (session?.user as { name?: string })?.name ?? 'an admin'
    }.`,
    link: `/admin/customers/${id}`,
    meta: { userId: id, previousEmail: before.email ?? null, previousName: before.name ?? null }
  });

  return NextResponse.json({ ok: true, user: after });
}
