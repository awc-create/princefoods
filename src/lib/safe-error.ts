// src/lib/safe-error.ts
/**
 * Turns any thrown error into something safe and useful to show a staff member.
 *
 * Why this exists: admin API routes were returning `error: e.message` straight to
 * the browser, so staff saw things like:
 *
 *   Invalid `prisma.aboutSettings.upsert()` invocation: ConnectorError(...
 *   PostgresError { code: "53100", message: "could not extend file ..." })
 *
 * That tells a staff member nothing, and leaks internal schema/paths. The full
 * error is still logged server-side — only the friendly text crosses the wire.
 */

interface SafeError {
  /** Shown to the user. Plain English, actionable where possible. */
  message: string;
  /** Stable code for the UI to branch on if it wants. */
  code: string;
}

/** Postgres SQLSTATE / Prisma codes we can explain properly. */
const KNOWN: { test: (s: string) => boolean; code: string; message: string }[] = [
  {
    // 53100 disk full, 53200 out of memory, 53300 too many connections
    test: (s) => s.includes('53100') || s.includes('No space left on device'),
    code: 'DB_DISK_FULL',
    message:
      'The database has run out of disk space, so nothing can be saved right now. This needs a system administrator — please report it before making further changes.'
  },
  {
    test: (s) => s.includes('53300') || s.includes('too many clients'),
    code: 'DB_BUSY',
    message: 'The database is too busy to accept this right now. Please wait a moment and try again.'
  },
  {
    test: (s) => s.includes('53200'),
    code: 'DB_OUT_OF_MEMORY',
    message: 'The database ran out of memory handling this request. Please report it to an administrator.'
  },
  {
    test: (s) => s.includes('P1001') || s.includes('P1002') || s.includes("Can't reach database"),
    code: 'DB_UNREACHABLE',
    message: 'Cannot reach the database. Check your connection and try again — if it persists, report it.'
  },
  {
    test: (s) => s.includes('P2024') || s.includes('Timed out fetching a new connection'),
    code: 'DB_TIMEOUT',
    message: 'The database took too long to respond. Please try again.'
  },
  {
    test: (s) => s.includes('P2002') || s.includes('Unique constraint'),
    code: 'DUPLICATE',
    message: 'Something with that value already exists. Please use a different one.'
  },
  {
    test: (s) => s.includes('P2025') || s.includes('Record to update not found'),
    code: 'NOT_FOUND',
    message: 'That item no longer exists — it may have been deleted by someone else.'
  },
  {
    test: (s) => s.includes('P2003') || s.includes('Foreign key constraint'),
    code: 'IN_USE',
    message: 'This is still linked to other records, so it cannot be changed or removed yet.'
  },
  {
    test: (s) => s.includes('ECONNREFUSED') || s.includes('ETIMEDOUT') || s.includes('ENOTFOUND'),
    code: 'UPSTREAM_UNREACHABLE',
    message: 'Could not reach an external service. Please try again shortly.'
  }
];

/**
 * @param err     the caught error
 * @param context short label for the server log, e.g. 'POST /api/admin/site/about/save'
 * @param fallback user-facing text when we don't recognise the error
 */
export function safeError(
  err: unknown,
  context: string,
  fallback = 'Something went wrong. Please try again — if it keeps happening, report it.'
): SafeError {
  // Always keep the real thing in the server logs.
  console.error(`[${context}]`, err);

  const raw = err instanceof Error ? `${err.message}` : String(err ?? '');

  for (const k of KNOWN) {
    if (k.test(raw)) return { message: k.message, code: k.code };
  }

  // Validation errors we raise ourselves are already user-safe and short.
  if (err instanceof Error && err.name === 'ValidationError') {
    return { message: err.message, code: 'VALIDATION' };
  }

  return { message: fallback, code: 'UNKNOWN' };
}

/** Convenience: just the user-facing string. */
export function safeErrorMessage(err: unknown, context: string, fallback?: string): string {
  return safeError(err, context, fallback).message;
}
