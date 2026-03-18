// src/lib/rate-limit.ts
// In-memory sliding window rate limiter.
// Works perfectly for a single Node.js server (Hetzner).
// If you ever scale to multiple servers, swap the Map for Redis.

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Global store — persists across requests in the same Node.js process
const store = new Map<string, WindowEntry>();

// Clean up expired entries every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        if (entry.resetAt < now) store.delete(key);
      }
    },
    5 * 60 * 1000
  );
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in seconds */
  windowSecs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // unix ms
}

/**
 * Check and increment the rate limit for a given key.
 * Key should be: `${route}:${ip}` or `${route}:${email}` etc.
 */
export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSecs * 1000;

  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Start a new window
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: config.limit - 1, resetAt: entry.resetAt };
  }

  entry.count += 1;

  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

// ─── Pre-configured limiters ────────────────────────────────────────────────

/** Auth: sign-in attempts — 10 per 15 min per IP */
export const loginLimiter = (ip: string) =>
  rateLimit(`login:${ip}`, { limit: 10, windowSecs: 900 });

/** Email verification sends — 5 per hour per email */
export const verifyEmailLimiter = (email: string) =>
  rateLimit(`verify:${email}`, { limit: 5, windowSecs: 3600 });

/** Checkout place-order — 20 per hour per IP (generous for real customers) */
export const checkoutLimiter = (ip: string) =>
  rateLimit(`checkout:${ip}`, { limit: 20, windowSecs: 3600 });

/** Promo code evaluation — 30 per 10 min per IP (stops brute forcing codes) */
export const promoLimiter = (ip: string) =>
  rateLimit(`promo:${ip}`, { limit: 30, windowSecs: 600 });

/** Profile/account changes — 20 per 10 min per IP */
export const accountLimiter = (ip: string) =>
  rateLimit(`account:${ip}`, { limit: 20, windowSecs: 600 });

/** Password/magic link requests — 5 per 15 min per IP */
export const magicLinkLimiter = (ip: string) =>
  rateLimit(`magic:${ip}`, { limit: 5, windowSecs: 900 });

/** Offer/badge API — 60 per min per IP (frontend polls this) */
export const offerLimiter = (ip: string) => rateLimit(`offer:${ip}`, { limit: 60, windowSecs: 60 });
