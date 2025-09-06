// src/lib/url.ts
import { absUrl } from './abs-url';

export function urlFrom(input: string | URL): URL {
  try {
    if (input instanceof URL) return input;
    const s = String(input);
    if (/^https?:\/\//i.test(s)) return new URL(s);
    return new URL(s, absUrl('/')); // always supply a solid base
  } catch {
    // Never throw; at worst return the site root as a URL
    return new URL(absUrl('/'));
  }
}
