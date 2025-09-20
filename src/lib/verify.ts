import { prisma } from '@/lib/prisma';
import { urlFrom } from '@/lib/url';
import crypto from 'crypto';

const TOKEN_BYTES = 24;
export const VERIFY_WINDOW_MIN = Number(process.env.VERIFY_WINDOW_MIN ?? 15);
export const RESEND_COOLDOWN_SEC = Number(process.env.VERIFY_RESEND_COOLDOWN_SEC ?? 60);

const genTokenRaw = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

// Your legacy prefixes (safe to keep for your own endpoints)
const LINK_PREFIX = 'L:';
const CODE_PREFIX = 'C:';

async function latestVerification(identifierEmail: string) {
  return prisma.verificationToken.findFirst({
    where: { identifier: identifierEmail },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, expires: true }
  });
}

/**
 * Build a NextAuth magic-link to auto-login on click.
 * - `hostOrigin` should be the origin the user is on (public or admin),
 *   e.g. "https://prince-v.com" or "https://admin.prince-v.com"
 * - `callbackUrl` is where to land after login (can be the same origin’s home)
 */
export function buildNextAuthMagicLink(
  hostOrigin: string,
  email: string,
  token: string,
  callbackUrl?: string
) {
  const base = urlFrom('/api/auth/callback/email', hostOrigin);
  base.searchParams.set('token', token); // IMPORTANT: token WITHOUT any prefix
  base.searchParams.set('email', email);
  base.searchParams.set('callbackUrl', callbackUrl ?? hostOrigin);
  return base.toString();
}

/**
 * mode = 'initial'  → always issue; used right after signup / start-flow
 * mode = 'resend'   → only issue IF a prior verification exists for this email.
 *                     Cooldown enforced by RESEND_COOLDOWN_SEC.
 *
 * RETURN:
 *  - tokenRawLegacy:   string  (with your LINK_PREFIX, if you still use your own verify URL)
 *  - tokenRawNextAuth: string  (NO prefix; embed this in /api/auth/callback/email link)
 *  - code:             string  (6-digit backup/alt verification)
 */
export async function issueEmailVerification(
  identifierEmail: string,
  mode: 'initial' | 'resend' = 'initial'
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFY_WINDOW_MIN * 60 * 1000);

  const latest = await latestVerification(identifierEmail);

  if (mode === 'resend') {
    // Only allow if user previously started verification (any prior token ever)
    if (!latest) {
      // No-op to avoid email enumeration
      return { ok: false as const, reason: 'noop' };
    }
    // Enforce resend cooldown from last send time
    if (RESEND_COOLDOWN_SEC > 0 && latest.createdAt) {
      const secsSince = (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (secsSince < RESEND_COOLDOWN_SEC) {
        return { ok: false as const, reason: 'cooldown' };
      }
    }
  }

  // Clean any pending rows for this identifier (fresh set each time)
  await prisma.verificationToken.deleteMany({ where: { identifier: identifierEmail } });

  // 1) Your legacy link token (kept for compatibility with any existing /welcome/verify route)
  const tokenRawLegacy = genTokenRaw();
  // 2) The NextAuth-compatible token (NO prefix) — this is the one that creates the session
  const tokenRawNextAuth = genTokenRaw();
  // 3) A 6-digit code (kept if you still support code-based verification)
  const code = genCode();

  // Store rows:
  // - Legacy link row with your 'L:' prefix
  await prisma.verificationToken.create({
    data: {
      identifier: identifierEmail,
      token: `${LINK_PREFIX}${tokenRawLegacy}`,
      expires: expiresAt
    }
  });
  // - NextAuth magic-link row WITHOUT any prefix (Auth.js expects raw token)
  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: tokenRawNextAuth, expires: expiresAt }
  });
  // - 6-digit code row with 'C:' prefix
  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: `${CODE_PREFIX}${code}`, expires: expiresAt }
  });

  return {
    ok: true as const,
    tokenRawLegacy,
    tokenRawNextAuth,
    code,
    expiresAt,
    expiresInMinutes: VERIFY_WINDOW_MIN
  };
}

/**
 * If you still support your own "verify by link" endpoint, it will use this.
 * NOTE: This does NOT log the user in. Prefer sending the NextAuth magic-link instead.
 */
export async function consumeVerificationByToken(email: string, tokenRaw: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `${LINK_PREFIX}${tokenRaw}`, expires: { gt: now } }
  });
  if (!row) return { ok: false as const, reason: 'bad-token' };

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  return { ok: true as const };
}

/**
 * If you still support 6-digit code input somewhere, keep this.
 * (Again: code path verifies account but won’t create a session by itself.)
 */
export async function consumeVerificationByCode(email: string, code: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `${CODE_PREFIX}${code}`, expires: { gt: now } }
  });
  if (!row) return { ok: false as const, reason: 'bad-code' };

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  return { ok: true as const };
}
