// src/app/api/admin/site/faq/answer/route.ts
/**
 * Answer (or dismiss) a question submitted through the public FAQ page.
 *
 * One call does up to three things, because doing them separately is what
 * made staff write the same answer twice:
 *   1. stores the answer on the question,
 *   2. optionally publishes it to the public FAQ list — under a *rewritten*
 *      question, since what a customer typed is often not what should appear
 *      on the page,
 *   3. emails the asker, if they left an address.
 *
 * The database work is one transaction. The email is sent after it commits:
 * an email that fails must not roll back a saved answer, and an email cannot
 * be un-sent if the transaction later fails.
 */
import { sendFaqAnswerEmail } from '@/lib/email';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-admin';
import { safeError } from '@/lib/safe-error';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_ANSWER_LEN = 5000;
const MAX_QUESTION_LEN = 500;

interface AnswerBody {
  id?: string;
  /** Omit or leave empty when only dismissing. */
  answer?: string;
  /** Add this Q&A to the public FAQ list as well. */
  publish?: boolean;
  /** Public wording of the question — defaults to what the customer typed. */
  publicQuestion?: string;
  /** Close without replying (spam, duplicate, not a question). */
  dismiss?: boolean;
}

export async function POST(req: Request) {
  const guard = await requireAdmin({ write: true });
  if (!guard.ok) return guard.response;

  try {
    const body = (await req.json()) as AnswerBody;
    const id = body?.id?.trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing question id.' }, { status: 400 });
    }

    const question = await prisma.faqQuestion.findUnique({ where: { id } });
    if (!question) {
      return NextResponse.json({ ok: false, error: 'Question not found.' }, { status: 404 });
    }

    // ── Dismiss ──
    if (body.dismiss) {
      await prisma.faqQuestion.update({
        where: { id },
        data: { status: 'DISMISSED', answeredByEmail: guard.user.email ?? null, answeredAt: new Date() }
      });
      return NextResponse.json({ ok: true, status: 'DISMISSED' });
    }

    // ── Answer ──
    const answer = body?.answer?.trim().slice(0, MAX_ANSWER_LEN);
    if (!answer) {
      return NextResponse.json(
        { ok: false, error: 'Write an answer first, or dismiss the question.' },
        { status: 400 }
      );
    }

    // `||` not `??` on purpose: a cleared field arrives as '', and an empty
    // public question must fall back to the customer's original wording.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const publicQuestion = (body.publicQuestion?.trim() || question.question).slice(
      0,
      MAX_QUESTION_LEN
    );

    let publishedFaqId: string | null = question.publishedFaqId ?? null;

    await prisma.$transaction(async (tx) => {
      if (body.publish) {
        // `Faq.question` is unique, so re-publishing the same wording must
        // update the existing entry rather than blow up with a constraint
        // error in front of the admin.
        const faq = await tx.faq.upsert({
          where: { question: publicQuestion },
          create: { question: publicQuestion, answer, active: true },
          update: { answer, active: true }
        });
        publishedFaqId = faq.id;
      }

      await tx.faqQuestion.update({
        where: { id },
        data: {
          answer,
          status: 'ANSWERED',
          answeredAt: new Date(),
          answeredByEmail: guard.user.email ?? null,
          publishedFaqId,
          // A new answer is unread again, even if an earlier one was read.
          readAt: null
        }
      });
    });

    // ── Email, after the commit ──
    let emailed = false;
    let emailError: string | null = null;

    if (question.askerEmail) {
      try {
        await sendFaqAnswerEmail({
          to: question.askerEmail,
          name: question.askerName,
          question: question.question,
          answer
        });
        emailed = true;
      } catch (e) {
        // The answer IS saved and the customer can still see it in their
        // account. Report the failure so staff know to follow up, but don't
        // present the whole operation as failed.
        emailError = safeError(e, 'POST /api/admin/site/faq/answer (email)').message;
      }
    }

    return NextResponse.json({
      ok: true,
      status: 'ANSWERED',
      published: Boolean(body.publish),
      emailed,
      emailError,
      // Lets the UI say "saved, but no email address on file" rather than
      // implying the customer was contacted.
      hasEmail: Boolean(question.askerEmail)
    });
  } catch (e) {
    const { message, code } = safeError(
      e,
      'POST /api/admin/site/faq/answer',
      'Could not save that answer. Please try again.'
    );
    const status = code === 'VALIDATION' || code === 'DUPLICATE' ? 400 : 500;
    return NextResponse.json({ ok: false, error: message, code }, { status });
  }
}
