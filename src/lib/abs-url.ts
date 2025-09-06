// src/lib/abs-url.ts
/** Pick the first non-empty string (treat '' and whitespace as unset). */
function firstNonEmpty(...vals: Array<string | undefined | null>): string | undefined {
  for (const v of vals) {
    if (v != null && v.trim() !== '') return v.trim();
  }
  return undefined;
}

const BASE =
  firstNonEmpty(
    process.env.NEXT_PUBLIC_ADMIN_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL
  ) ?? 'http://localhost:3000';

/** Safe absolute URL builder (never throws on server) */
export function absUrl(path: string): string {
  try {
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, BASE).toString();
  } catch {
    // Last-resort fallback to localhost to avoid crashing prerender
    return path.startsWith('/') ? `http://localhost:3000${path}` : path;
  }
}
