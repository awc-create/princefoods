import { absUrl } from '@/lib/abs-url';

/** Always construct a URL with a known base to avoid build-time crashes. */
export function urlFrom(input: string | URL): URL {
  // already absolute -> pass through
  if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
    return new URL(input);
  }
  // everything else -> resolve against a safe base
  return new URL(String(input), absUrl('/'));
}
