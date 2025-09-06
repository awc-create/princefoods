// src/lib/url.ts
import { absUrl } from './abs-url';

export function urlFrom(input: string | URL): URL {
  if (input instanceof URL) return input;

  const s = String(input).trim();

  // Absolute HTTP(S) → construct directly
  if (/^https?:\/\//i.test(s)) {
    try {
      return new URL(s);
    } catch {
      // fall through to base-join fallback
    }
  }

  // Relative or anything weird → join with a safe base
  try {
    return new URL(s, absUrl('/'));
  } catch {
    // As a last resort, return the base itself
    return new URL(absUrl('/'));
  }
}
