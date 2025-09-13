import * as React from 'react';
import { renderAsync } from '@react-email/render';
import { getResendOrThrow } from './resend';
import WelcomeEmail from '@/emails/WelcomeEmail';
import { getFeaturedCategories, getBestSellers } from './catalog';

const FROM = process.env.EMAIL_FROM ?? 'Prince Foods <news@prince-v.com>';
const REPLY_TO =
  process.env.REPLY_TO ?? process.env.RESEND_REPLY_TO ?? 'support@prince-v.com';

/** Sends the welcome email and returns void (throws on Resend error). */
export async function sendWelcomeEmail(opts: { to: string; name?: string }) {
  const [categories, bestSellers] = await Promise.all([
    getFeaturedCategories(6),
    getBestSellers(4),
  ]);

  const html = await renderAsync(
    <WelcomeEmail
      name={opts.name}
      categories={categories}
      bestSellers={bestSellers}
    />,
    { pretty: true }
  );

  const resend = getResendOrThrow();
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: 'Welcome to Prince Foods 🎉',
    html,
    replyTo: REPLY_TO,
    tags: [{ name: 'category', value: 'welcome' }],
  });

  if (error) throw error;
}
