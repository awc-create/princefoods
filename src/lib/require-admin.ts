// src/lib/require-admin.ts
/**
 * Authorisation guard for /api/admin/* routes.
 *
 * Why this exists: `src/middleware.ts` deliberately skips `/api/`, so every admin
 * API route has to guard itself. Before this helper, 83 of 138 did not — including
 * routes that queued refunds and returned full customer records.
 *
 * Role policy:
 *   HEAD   — everything
 *   STAFF  — everything except staff management (handled per-route with `head: true`)
 *   VIEWER — read-only: GET is allowed, any write is rejected
 *
 * Usage at the top of a handler:
 *
 *   const guard = await requireAdmin({ write: true });
 *   if (!guard.ok) return guard.response;
 *   // guard.user.id / guard.user.email / guard.user.role are available
 */

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export type AdminRole = 'HEAD' | 'STAFF' | 'VIEWER';

export interface AdminUser {
  id: string | null;
  email: string | null;
  role: AdminRole;
}

export type AdminGuardResult =
  | { ok: true; user: AdminUser; response?: never }
  | { ok: false; user?: never; response: NextResponse };

interface SessionUserShape {
  id?: unknown;
  email?: unknown;
  role?: unknown;
}

function readSessionUser(u: unknown): SessionUserShape | null {
  return u && typeof u === 'object' ? (u as SessionUserShape) : null;
}

function asRole(v: unknown): AdminRole | null {
  return v === 'HEAD' || v === 'STAFF' || v === 'VIEWER' ? v : null;
}

export interface RequireAdminOptions {
  /** True for anything that changes data (POST/PUT/PATCH/DELETE). Blocks VIEWER. */
  write?: boolean;
  /** True if the route must be HEAD only (staff management, store settings). */
  head?: boolean;
}

/**
 * Resolves the current admin session and checks it against the route's needs.
 * Never throws — always returns either `ok: true` with the user, or `ok: false`
 * with the NextResponse to return.
 */
export async function requireAdmin(opts: RequireAdminOptions = {}): Promise<AdminGuardResult> {
  const session = await getServerSession(authOptions);
  const su = readSessionUser(session?.user);

  if (!su) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'You need to sign in to do that.' },
        { status: 401 }
      )
    };
  }

  const role = asRole(su.role);
  if (!role) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Your account does not have admin access.' },
        { status: 403 }
      )
    };
  }

  if (opts.head && role !== 'HEAD') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Only an account owner (HEAD) can do that.' },
        { status: 403 }
      )
    };
  }

  // VIEWER is read-only.
  if (opts.write && role === 'VIEWER') {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Your account has read-only access.' },
        { status: 403 }
      )
    };
  }

  return {
    ok: true,
    user: {
      id: typeof su.id === 'string' ? su.id : null,
      email: typeof su.email === 'string' ? su.email : null,
      role
    }
  };
}

/** Convenience for read-only (GET) handlers. */
export const requireAdminRead = () => requireAdmin({ write: false });

/** Convenience for handlers that change data. */
export const requireAdminWrite = () => requireAdmin({ write: true });
