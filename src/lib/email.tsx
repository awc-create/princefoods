import React from 'react';

import { Resend } from 'resend';
// ⬇️ use renderAsync instead of render
import { renderAsync } from '@react-email/render';
import ChatSLAEmail from '@/emails/ChatSLAEmail';

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM = process.env.EMAIL_FROM || 'Prince Foods <support@prince-foods.com>';
const DEFAULT_TO = process.env.SUPPORT_EMAIL || 'support@prince-foods.com';

export async function sendSlaEmailTemplate(params: {
  threadId: string;
  preview: string;
  adminUrl: string;
  minutesOverdue: number;
  to?: string | string[];
}) {
  // ⬇️ await the HTML so it’s a string
  const html = await renderAsync(
    <ChatSLAEmail
      threadId={params.threadId}
      preview={params.preview}
      adminUrl={params.adminUrl}
      minutesOverdue={params.minutesOverdue}
      brand={{
        primary: '#D62828',
        logoUrl: `${process.env.APP_BASE_URL ?? 'https://www.prince-foods.com'}/assets/prince-foods-logo.png`,
        supportEmail: DEFAULT_TO,
      }}
    />
  );

  const to = Array.isArray(params.to) ? params.to : [params.to || DEFAULT_TO];

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Chat SLA breached • ${params.threadId}`,
    html,                                  // ✅ now a string
    replyTo: process.env.REPLY_TO || DEFAULT_TO,
    tags: [{ name: 'category', value: 'chat-sla' }],
  });

  if (error) {
    console.error('Resend error:', error);
    throw error;
  }
}
