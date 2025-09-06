const FALLBACK =
  process.env.NEXT_PUBLIC_ADMIN_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.SITE_URL ||
  'http://localhost:3000';

/** Safe absolute URL builder (never throws on server) */
export function absUrl(path: string): string {
  try {
    // If already absolute, just return as-is
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, FALLBACK).toString();
  } catch {
    // Last resort: return the input to avoid crashing prerender
    return path;
  }
}
