// lib/auth/verify-tokens.ts
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const TOKEN_BYTES = 24;
export const VERIFY_WINDOW_MIN = Number(process.env.VERIFY_WINDOW_MIN ?? 15);
export const RESEND_COOLDOWN_SEC = Number(process.env.VERIFY_RESEND_COOLDOWN_SEC ?? 60);

const LINK_PREFIX = 'L:';
const CODE_PREFIX = 'C:';

const genTokenRaw = () => crypto.randomBytes(TOKEN_BYTES).toString('base64url');
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

async function latestVerification(identifierEmail: string) {
  return prisma.verificationToken.findFirst({
    where: { identifier: identifierEmail },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, expires: true }
  });
}

/**
 * mode = 'initial'  → always issue (after signup / start-flow)
 * mode = 'resend'   → only issue if a prior verification exists (cooldown enforced)
 */
export async function issueEmailVerification(
  identifierEmail: string,
  mode: 'initial' | 'resend' = 'initial'
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + VERIFY_WINDOW_MIN * 60 * 1000);

  const latest = await latestVerification(identifierEmail);

  if (mode === 'resend') {
    if (!latest) return { ok: false as const, reason: 'noop' as const };
    if (RESEND_COOLDOWN_SEC > 0 && latest.createdAt) {
      const secsSince = (now.getTime() - latest.createdAt.getTime()) / 1000;
      if (secsSince < RESEND_COOLDOWN_SEC) {
        return { ok: false as const, reason: 'cooldown' as const };
      }
    }
  }

  // Always refresh pair/trio
  await prisma.verificationToken.deleteMany({ where: { identifier: identifierEmail } });

  const tokenRawNextAuth = genTokenRaw(); // for NextAuth callback/email provider
  const tokenRaw = genTokenRaw(); // your prefixed link token
  const code = genCode(); // 6-digit fallback

  // 1) NextAuth-compatible row (no prefix) -> lets /api/auth/callback/email consume it and sign the user in
  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: tokenRawNextAuth, expires: expiresAt }
  });

  // 2) Your link token (prefixed)
  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: `${LINK_PREFIX}${tokenRaw}`, expires: expiresAt }
  });

  // 3) Your code token (prefixed)
  await prisma.verificationToken.create({
    data: { identifier: identifierEmail, token: `${CODE_PREFIX}${code}`, expires: expiresAt }
  });

  return {
    ok: true as const,
    tokenRawNextAuth, // <- use this to build the NextAuth magic link
    tokenRaw, // <- if you still want your own verify link somewhere
    code,
    expiresAt,
    expiresInMinutes: VERIFY_WINDOW_MIN
  };
}

export async function consumeVerificationByToken(email: string, tokenRaw: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `L:${tokenRaw}`, expires: { gt: now } }
  });
  if (!row) return { ok: false as const, reason: 'bad-token' as const };
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  return { ok: true as const };
}

export async function consumeVerificationByCode(email: string, code: string) {
  const now = new Date();
  const row = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: `C:${code}`, expires: { gt: now } }
  });
  if (!row) return { ok: false as const, reason: 'bad-code' as const };
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  return { ok: true as const };
}
