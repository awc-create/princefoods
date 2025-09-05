import { prisma } from '@/lib/prisma';
import { getResendOrThrow } from './resend';

const FROM = process.env.EMAIL_FROM ?? 'Prince Foods <support@prince-foods.com>';
const REPLIES_DOMAIN = process.env.REPLIES_DOMAIN ?? 'replies.prince-foods.com';

export async function emailCustomerFromThread({
  threadId,
  to,
  subject,
  html
}: {
  threadId: string;
  to: string;
  subject: string;
  html: string;
}) {
  const replyAlias = `support+${threadId}@${REPLIES_DOMAIN}`;

  const resend = getResendOrThrow();
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    replyTo: replyAlias, // <-- camelCase
    headers: { 'X-Thread-Id': threadId }
  });
  if (error) throw error;

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { customerEmail: to }
  });
}
