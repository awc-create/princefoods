import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client'; // value import
import { getServerSession } from 'next-auth';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface SessionUser {
  id?: string;
  email?: string;
  role?: Role;
}

/**
 * Coerce unknown -> Prisma JSON input for a *nullable* JSON column.
 * Return type matches what Prisma accepts on create/update:
 *   NullableJsonNullValueInput | InputJsonValue
 * - undefined  -> DbNull        (store DB NULL)
 * - null       -> JsonNull      (store JSON null)
 * - serializable -> JSON value  (InputJsonValue)
 * - non-serializable/cyclic -> DbNull
 */
function toJsonInput(value: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === undefined) return Prisma.DbNull;
  if (value === null) return Prisma.JsonNull;
  try {
    const s = JSON.stringify(value);
    if (s === undefined) return Prisma.DbNull;
    // Parsed value is a valid JSON primitive/object/array
    return JSON.parse(s) as unknown as Prisma.InputJsonValue;
  } catch {
    return Prisma.DbNull;
  }
}

export async function logUserAudit(p: {
  userId: string;
  action: 'CREATE' | 'UPDATE' | 'RESTRICT' | 'ANONYMIZE' | 'RESTORE' | 'HARD_DELETE';
  reason?: string;
  before?: unknown;
  after?: unknown;
}) {
  const session = await getServerSession(authOptions);
  const su = (session?.user ?? {}) as SessionUser;

  await prisma.userAudit.create({
    data: {
      userId: p.userId,
      action: p.action,
      reason: p.reason,
      before: toJsonInput(p.before),
      after: toJsonInput(p.after),
      actorId: su.id ?? null,
      actorEmail: su.email ?? null
    }
  });
}
