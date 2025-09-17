import { logUserAudit } from '@/lib/audit';
import { authOptions } from '@/lib/auth-options';
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
  if (isPromiseLike<T>(raw)) {
    return await raw;
  }
  return (raw ?? {}) as T;
}

export async function POST(_: NextRequest, ctx: unknown) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as Partial<{ role: Role }> | undefined)?.role ?? null;
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (role !== 'HEAD') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await getParams<{ id: string }>(ctx);

  const before = await prisma.user.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });

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
      deletedAt: new Date(),
      restrictedAt: new Date(),
      role: 'VIEWER',
      deletionReason: 'Anonymized via admin action'
    }
  });

  await logUserAudit({
    userId: id,
    action: 'ANONYMIZE',
    before,
    after,
    reason: 'Admin request'
  });

  return NextResponse.json({ ok: true, user: after });
}
