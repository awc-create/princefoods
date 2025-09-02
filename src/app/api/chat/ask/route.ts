import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { searchDocs, buildAnswer } from '@/lib/faqSearch';
import { sendAdminPush } from '@/lib/push';
import { socketEmit } from '@/lib/socketEmit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLA_MIN = Number(process.env.CHAT_SLA_MINUTES || 10);

export async function POST(req: NextRequest) {
  try {
    const { message, userKey, threadId: providedThreadId } = await req.json();

    const thread = providedThreadId
      ? await prisma.chatThread.findUnique({ where: { id: providedThreadId } })
      : await prisma.chatThread.create({ data: { userKey, slaMinutes: SLA_MIN } });

    if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 });

    await prisma.chatMessage.create({ data: { threadId: thread.id, role: 'user', content: message } });
    await prisma.chatThread.update({ where: { id: thread.id }, data: { lastUserAt: new Date() } });

    const hits = await searchDocs(message);
    const { answer, confidence } = buildAnswer(hits);

    const assistantMsg = await prisma.chatMessage.create({
      data: { threadId: thread.id, role: 'assistant', content: answer, confidence }
    });

    const shouldEscalate = confidence < 0.6 || /passing this to a human/i.test(answer);

    if (shouldEscalate) {
      await prisma.chatMessage.create({ data: { threadId: thread.id, role: 'system', content: `ESCALATE: "${message}"` } });
      await prisma.chatThread.update({
        where: { id: thread.id },
        data: { escalatedAt: new Date(), emailEscalationSentAt: null }
      });

      // Push + Socket to admins (non-blocking)
      sendAdminPush('New chat escalation', message).catch(() => {});
      socketEmit('admins', 'new_escalation', { threadId: thread.id, preview: message, confidence }).catch(() => {});
    }

    // Broadcast assistant message to user room (non-blocking)
    socketEmit(`thread-${thread.id}`, 'message', { role: 'assistant', content: answer }).catch(() => {});

    return NextResponse.json({
      threadId: thread.id,
      messageId: assistantMsg.id,
      answer,
      confidence,
      escalated: shouldEscalate,
    });
  } catch (e: any) {
    console.error('/api/chat/ask error:', e);
    return NextResponse.json({ error: 'Chat failed. Please try again.' }, { status: 500 });
  }
}
