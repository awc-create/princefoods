// src/lib/abs-url.ts
const CANDIDATES = [
  process.env.NEXT_PUBLIC_ADMIN_URL,
  process.env.NEXT_PUBLIC_SITE_URL,
  process.env.SITE_URL,
  'http://localhost:3000'
].filter((v): v is string => typeof v === 'string' && v.trim().length > 0);

// Guaranteed non-empty, valid-enough base
const FALLBACK_BASE = CANDIDATES[0] ?? 'http://localhost:3000';

/** Safe absolute URL builder (never throws) */
export function absUrl(path?: string | null): string {
  // Default to "/" if path is missing/blank
  const p = typeof path === 'string' && path.trim().length > 0 ? path : '/';

  // Already absolute? return as-is
  if (/^https?:\/\//i.test(p)) return p;

  try {
    return new URL(p, FALLBACK_BASE).toString();
  } catch {
    // Last resorts: try base root, then just "/"
    try {
      return new URL('/', FALLBACK_BASE).toString();
    } catch {
      return '/';
    }
  }
}
