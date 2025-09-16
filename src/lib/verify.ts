import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const TOKEN_BYTES = 24;
export const VERIFY_WINDOW_MIN = Number(process.env.VERIFY_WINDOW_MIN ?? 15);
export const RESEND_COOLDOWN_SEC = Number(process.env.VERIFY_RESEND_COOLDOWN_SEC ?? 60);

const genTokenRaw = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

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
 * mode = 'initial'  → always issue; used right after signup / start-flow
 * mode = 'resend'   → only issue IF a prior verification exists for this email.
 *                     Cooldown enforced by RESEND_COOLDOWN_SEC.
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

  // Clean any pending rows for this identifier (fresh pair each time)
  await prisma.verificationToken.deleteMany({ where: { identifier: identifierEmail } });

  const tokenRaw = genTokenRaw();
  const code = genCode();

  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: `${LINK_PREFIX}${tokenRaw}`, expires: expiresAt }
  });
  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: `${CODE_PREFIX}${code}`, expires: expiresAt }
  });

  return { ok: true as const, tokenRaw, code, expiresAt, expiresInMinutes: VERIFY_WINDOW_MIN };
}

export async function consumeVerificationByToken(email: string, tokenRaw: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `${LINK_PREFIX}${tokenRaw}`, expires: { gt: now } }
  });
  if (!row) return { ok: false as const, reason: 'bad-token' };

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  return { ok: true as const };
}

export async function consumeVerificationByCode(email: string, code: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `${CODE_PREFIX}${code}`, expires: { gt: now } }
  });
  if (!row) return { ok: false as const, reason: 'bad-code' };

  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  return { ok: true as const };
}
