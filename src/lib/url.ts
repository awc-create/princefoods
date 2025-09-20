// src/lib/url.ts
import { absUrl } from './abs-url';

/**
 * Safe URL constructor that:
 * - Accepts absolute URLs directly
 * - Joins relative paths against a provided base (if given)
 * - Otherwise falls back to a safe app base via absUrl('/')
 *
 * Examples:
 *   urlFrom('https://a.com/x')                     -> URL('https://a.com/x')
 *   urlFrom('/x', 'https://a.com')                 -> URL('https://a.com/x')
 *   urlFrom('/x')                                  -> URL(absUrl('/x'))
 *   urlFrom(new URL('https://a.com/x'))            -> same URL
 */
export function urlFrom(input: string | URL, base?: string | URL): URL {
  if (input instanceof URL) return input;

  const s = String(input).trim();

  // If absolute HTTP(S), construct directly
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s);
    } catch {
      // fall through to base-join
    }
  }

  // Determine the base to use (explicit base > app base)
  const baseHref =
    typeof base === 'string' ? base : base instanceof URL ? base.toString() : absUrl('/'); // safe app base

  try {
    return new URL(s, baseHref);
  } catch {
    // As a last resort, return the base itself (parsed)
    return new URL(baseHref);
  }
}
