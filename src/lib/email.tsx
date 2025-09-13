import ChatSLAEmail from '@/emails/ChatSLAEmail';
import WelcomeEmail from '@/emails/WelcomeEmail';
import { renderAsync } from '@react-email/render';
import { getResendOrThrow } from './resend';

const FROM = process.env.EMAIL_FROM ?? 'Prince Foods <support@prince-foods.com>';
const DEFAULT_TO = process.env.SUPPORT_EMAIL ?? 'support@prince-foods.com';

/** Match the props your WelcomeEmail expects */
export interface CategoryTeaser {
  title: string;
  href: string;
  image: string;
}
export interface ProductTeaser {
  id: string;
  title: string;
  href: string;
  image: string;
  price?: number | null;
}

/**
 * Send SLA breach email to support/admins
 */
export async function sendSlaEmailTemplate(params: {
  threadId: string;
  preview: string;
  adminUrl: string;
  minutesOverdue: number;
  to?: string | string[];
}) {
  const html = await renderAsync(
    <ChatSLAEmail
      threadId={params.threadId}
      preview={params.preview}
      adminUrl={params.adminUrl}
      minutesOverdue={params.minutesOverdue}
      brand={{
        primary: '#D62828',
        logoUrl: `${
          process.env.NEXT_PUBLIC_ADMIN_URL ??
          process.env.SITE_URL ??
          'https://www.prince-foods.com'
        }/assets/prince-foods-logo.png`,
        supportEmail: DEFAULT_TO
      }}
    />
  );

  const to = Array.isArray(params.to) ? params.to : [params.to ?? DEFAULT_TO];

  const resend = getResendOrThrow();
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Chat SLA breached • ${params.threadId}`,
    html,
    replyTo: process.env.REPLY_TO ?? DEFAULT_TO,
    tags: [{ name: 'category', value: 'chat-sla' }]
  });

  if (error) throw error;
}

/**
 * Simple Welcome (no verification)
 */
export async function sendWelcomeEmail(params: { to: string; name?: string }) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';
  const html = await renderAsync(<WelcomeEmail name={params.name} siteUrl={siteUrl} />);

  const resend = getResendOrThrow();
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Welcome to Prince Foods',
    html,
    replyTo: process.env.REPLY_TO ?? process.env.SUPPORT_EMAIL ?? undefined,
    tags: [{ name: 'category', value: 'welcome' }]
  });

  if (error) throw error;
}

/**
 * Welcome + verification (code + one-click link)
 */
export async function sendWelcomeVerifyEmail(params: {
  to: string;
  name?: string;
  code: string; // e.g. "416829"
  verifyUrl: string;
  expiresInMinutes?: number;
  categories?: CategoryTeaser[];
  bestSellers?: ProductTeaser[];
}) {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://prince-v.com';

  const html = await renderAsync(
    <WelcomeEmail
      name={params.name}
      siteUrl={siteUrl}
      verificationCode={params.code}
      verifyUrl={params.verifyUrl}
      expiresInMinutes={params.expiresInMinutes ?? 15}
      categories={params.categories}
      bestSellers={params.bestSellers}
    />
  );

  const resend = getResendOrThrow();
  const { error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Verify your Prince Foods account',
    html,
    replyTo: process.env.REPLY_TO ?? process.env.SUPPORT_EMAIL ?? undefined,
    tags: [{ name: 'category', value: 'welcome-verify' }]
  });

  if (error) throw error;
}
