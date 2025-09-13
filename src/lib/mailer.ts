// src/lib/mailer.ts
import { Resend } from 'resend';

const resendKey = process.env.RESEND_API_KEY ?? '';
const resendFrom = process.env.RESEND_FROM ?? 'Prince Foods <no-reply@prince-v.com>';
const resendReplyTo = process.env.RESEND_REPLY_TO ?? undefined;

export const resend = new Resend(resendKey);

export async function sendMail(params: {
  subject: string;
  react?: React.ReactElement;
  html?: string;
  to: string | string[];
  bcc?: string | string[];
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND disabled (no API key). Skipping send.');
    return { skipped: true };
  }
  return resend.emails.send({
    from: resendFrom,
    to: params.to,
    replyTo: resendReplyTo,
    bcc: params.bcc,
    subject: params.subject,
    react: params.react, // prefer react; Resend renders HTML
    html: params.html // fallback if you pass raw HTML
  });
}
