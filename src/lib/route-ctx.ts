// src/lib/route-ctx.ts
import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';

export type RouteParams = Record<string, string>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Safe extractor for Next.js route context without using `any`. */
export function getParams<T extends RouteParams = { id: string }>(ctx: unknown): T {
  if (isRecord(ctx) && 'params' in ctx) {
    const p = (ctx as { params?: unknown }).params;
    if (isRecord(p)) return p as T;
  }
  throw new Error('Route params missing');
}

export interface AdminGuardUser {
  id: string;
  email: string;
  role: 'HEAD' | 'STAFF' | 'VIEWER';
  name?: string | null;
}

/**
 * Require an authenticated admin user.
 * - HEAD and STAFF allowed
 * - VIEWER forbidden
 */
export async function requireAdmin(): Promise<AdminGuardUser> {
  const session = await getServerSession(authOptions);

  const user = session?.user as Partial<AdminGuardUser> | undefined;
  if (!user?.id || !user?.email || !user?.role) {
    throw new Error('UNAUTHENTICATED');
  }

  if (user.role !== 'HEAD' && user.role !== 'STAFF') {
    throw new Error('FORBIDDEN');
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name ?? null
  };
}
