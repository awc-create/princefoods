// src/lib/resend.ts
import { Resend } from 'resend';

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export function getResendOrThrow(): Resend {
  const r = getResend();
  if (!r) throw new Error('RESEND_API_KEY missing');
  return r;
}
