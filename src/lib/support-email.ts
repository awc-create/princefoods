import { prisma } from '@/lib/prisma';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);
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

  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    replyTo: replyAlias, // ✅ correct key
    headers: { 'X-Thread-Id': threadId }
  });
  if (error) throw error;

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { customerEmail: to } // ✅ works after migrate/generate
  });
}
