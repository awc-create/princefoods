// src/lib/rate-limit-response.ts
// Shared helper for API routes to apply rate limiting and return 429.

import type { RateLimitResult } from './rate-limit';

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000))
  };
}

export function tooManyRequests(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ ok: false, error: 'Too many requests. Please try again shortly.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders(result)
      }
    }
  );
}

/** Get the real IP from Next.js request headers */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
