// src/lib/request-origin.ts
import { headers } from 'next/headers';

/**
 * Build a safe absolute origin for server-side fetches.
 * Fixes: "Failed to parse URL from /api/..."
 */
export async function getRequestOrigin() {
  // Next versions differ: headers() may be sync or async typed.
  // Promise.resolve handles both.
  const h = await Promise.resolve(headers());

  const proto =
    h.get('x-forwarded-proto') ?? (process.env.NODE_ENV === 'production' ? 'https' : 'http');

  const host =
    h.get('x-forwarded-host') ??
    h.get('host') ??
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '') ??
    'localhost:3000';

  return `${proto}://${host}`;
}
