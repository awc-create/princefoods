import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emailCustomerFromThread } from '@/lib/support-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // TODO: auth for HEAD/STAFF
  const { threadId, to, subject, html } = await req.json() as {
    threadId?: string;
    to?: string;
    subject?: string;
    html?: string;
  };

  if (!threadId) {
    return NextResponse.json({ error: 'threadId required' }, { status: 400 });
  }

  let recipient: string;
  if (to && to.trim()) {
    recipient = to.trim();
  } else {
    const t = await prisma.chatThread.findUnique({
      where: { id: threadId },
      select: { customerEmail: true }, // ✅ valid select
    });
    if (!t?.customerEmail) {
      return NextResponse.json(
        { error: 'customerEmail missing; provide "to" or store it on the thread.' },
        { status: 400 }
      );
    }
    recipient = t.customerEmail;
  }

  const subj = subject ?? 'Re: your Prince Foods question';
  const bodyHtml =
    html ?? `<p>Hi! Thanks for your message — replying here by email is fine. We’ll keep everything in one place.</p>`;

  await emailCustomerFromThread({
    threadId,
    to: recipient, // ✅ definitely a string now
    subject: subj,
    html: bodyHtml,
  });

  return NextResponse.json({ ok: true });
}
