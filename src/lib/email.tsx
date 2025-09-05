import ChatSLAEmail from '@/emails/ChatSLAEmail';
import { renderAsync } from '@react-email/render';
import { getResendOrThrow } from './resend';

const FROM = process.env.EMAIL_FROM ?? 'Prince Foods <support@prince-foods.com>';
const DEFAULT_TO = process.env.SUPPORT_EMAIL ?? 'support@prince-foods.com';

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
        logoUrl: `${process.env.NEXT_PUBLIC_ADMIN_URL ?? process.env.SITE_URL ?? 'https://www.prince-foods.com'}/assets/prince-foods-logo.png`,
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
    replyTo: process.env.REPLY_TO ?? DEFAULT_TO, // <-- camelCase
    tags: [{ name: 'category', value: 'chat-sla' }]
  });

  if (error) throw error;
}
