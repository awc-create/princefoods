import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const TOKEN_BYTES = 24;
export const VERIFY_WINDOW_MIN = Number(process.env.VERIFY_WINDOW_MIN ?? 15);
export const RESEND_COOLDOWN_SEC = Number(process.env.VERIFY_RESEND_COOLDOWN_SEC ?? 60);

const genTokenRaw = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');
const genCode = () => String(Math.floor(100000 + Math.random() * 900000)); // 6-digit numeric

// We store two rows in VerificationToken:
//  - Link token: token = "L:<tokenRaw>"
//  - Code token: token = "C:<6digit>"
const LINK_PREFIX = 'L:';
const CODE_PREFIX = 'C:';

export async function issueEmailVerification(identifierEmail: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFY_WINDOW_MIN * 60 * 1000);

  // Simple cooldown: if a not-yet-expired token exists created "very recently", throttle
  // Since VerificationToken has no createdAt, we’ll throttle by refusing if any unexpired token exists
  // and RESEND_COOLDOWN_SEC is set. (Keeps it simple + schema-free.)
  if (RESEND_COOLDOWN_SEC > 0) {
    const existing = await prisma.verificationToken.findFirst({
      where: {
        identifier: identifierEmail,
        expires: { gt: now }
      }
    });
    if (existing) {
      return { ok: false as const };
    }
  }

  // Clean up any stale tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: identifierEmail }
  });

  const tokenRaw = genTokenRaw();
  const code = genCode();

  // Create link token
  await prisma.verificationToken.create({
    data: {
      identifier: identifierEmail,
      token: `${LINK_PREFIX}${tokenRaw}`,
      expires: expiresAt
    }
  });

  // Create code token
  await prisma.verificationToken.create({
    data: {
      identifier: identifierEmail,
      token: `${CODE_PREFIX}${code}`,
      expires: expiresAt
    }
  });

  return {
    ok: true as const,
    tokenRaw,
    code,
    expiresAt,
    expiresInMinutes: VERIFY_WINDOW_MIN
  };
}

export async function consumeVerificationByToken(email: string, tokenRaw: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      token: `${LINK_PREFIX}${tokenRaw}`,
      expires: { gt: now }
    }
  });
  if (!row) return { ok: false as const, reason: 'bad-token' };

  // On success, delete all pending tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email }
  });

  return { ok: true as const };
}

export async function consumeVerificationByCode(email: string, code: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      token: `${CODE_PREFIX}${code}`,
      expires: { gt: now }
    }
  });
  if (!row) return { ok: false as const, reason: 'bad-code' };

  // On success, delete all pending tokens for this email
  await prisma.verificationToken.deleteMany({
    where: { identifier: email }
  });

  return { ok: true as const };
}
