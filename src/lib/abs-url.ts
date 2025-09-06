// src/lib/abs-url.ts
const FALLBACK =
  process.env.NEXT_PUBLIC_ADMIN_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.SITE_URL ??
  'http://localhost:3000';

export function absUrl(path: string): string {
  try {
    if (/^https?:\/\//i.test(path)) return path;
    return new URL(path, FALLBACK).toString();
  } catch {
    return path;
  }
}
