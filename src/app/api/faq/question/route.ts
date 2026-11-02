import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, tooManyRequests } from '@/lib/rate-limit-response';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

/** Longest question we'll store. Anything beyond this is a paste or an abuse. */
const MAX_QUESTION_LEN = 500;

/**
 * How many stored questions to compare a new one against. The grouping pass is
 * O(n) per request over every row, so an unbounded table would make this
 * endpoint slower the more it is used. Newest-first is the right window: near
 * duplicates arrive close together.
 */
const COMPARE_WINDOW = 500;

const MAX_NAME_LEN = 80;
const MAX_EMAIL_LEN = 254;

/** Deliberately loose — just enough to reject obvious nonsense. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** super-light text normalize */
function normalize(s: string) {
  const stop = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'of',
    'and',
    'or',
    'to',
    'in',
    'on',
    'at',
    'for',
    'with',
    'how',
    'what',
    'when',
    'where',
    'can',
    'do',
    'does',
    'i',
    'you',
    'we',
    'they',
    'it',
    'your',
    'my',
    'our'
  ]);
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !stop.has(w))
    .join(' ');
}

function jaccard(a: string, b: string) {
  if (!a || !b) return 0;
  const A = new Set(a.split(' '));
  const B = new Set(b.split(' '));
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export async function POST(req: Request) {
  // Unauthenticated endpoint that WRITES a row — without a limit anyone could
  // fill the table (and the disk) from a loop.
  const ip = getClientIp(req);
  const limit = rateLimit(`faq-question:${ip}`, { limit: 5, windowSecs: 600 });
  if (!limit.allowed) return tooManyRequests(limit);

  try {
    const body = (await req.json()) as { question?: string; email?: string; name?: string };
    const q = body?.question?.trim().slice(0, MAX_QUESTION_LEN);
    if (!q) return NextResponse.json({ ok: false, error: 'EMPTY' }, { status: 400 });

    // A signed-in asker is identified from the session, never from the body —
    // otherwise anyone could submit a question "as" another customer and have
    // the reply land in that person's account.
    const session = await getServerSession(authOptions);
    const sessionEmail = session?.user?.email?.toLowerCase() ?? null;

    let askerUserId: string | null = null;
    if (sessionEmail) {
      const user = await prisma.user.findUnique({
        where: { email: sessionEmail },
        select: { id: true }
      });
      askerUserId = user?.id ?? null;
    }

    // Email is optional. A signed-in customer's own address wins; otherwise
    // take what they typed, if it looks like an address at all.
    const typedEmail = body?.email?.trim().slice(0, MAX_EMAIL_LEN).toLowerCase();
    const askerEmail =
      sessionEmail ?? (typedEmail && EMAIL_RE.test(typedEmail) ? typedEmail : null);

    if (typedEmail && !askerEmail) {
      return NextResponse.json({ ok: false, error: 'BAD_EMAIL' }, { status: 400 });
    }

    // `||` not `??`: a blank name field arrives as '', which should fall
    // through to the account name rather than being stored as empty.
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
    const askerName =
      body?.name?.trim().slice(0, MAX_NAME_LEN) ||
      session?.user?.name?.slice(0, MAX_NAME_LEN) ||
      null;
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

    // Near-duplicates are merged into one row so the admin sees "asked 7 times"
    // rather than seven near-identical entries — but ONLY when nobody is
    // waiting on a reply. Merging an identified question into someone else's
    // row would send the answer to the wrong person, so anything with an email
    // or an account always gets its own row.
    const canMerge = !askerEmail && !askerUserId;

    if (canMerge) {
      const existing = await prisma.faqQuestion.findMany({
        // Only the two fields the comparison uses, newest first, capped.
        select: { id: true, question: true },
        orderBy: { updatedAt: 'desc' },
        take: COMPARE_WINDOW
      });

      let bestId: string | null = null;
      let bestScore = 0;
      for (const row of existing) {
        const score = jaccard(normalize(q), normalize(row.question));
        if (score > bestScore) {
          bestScore = score;
          bestId = row.id;
        }
      }

      const THRESHOLD = 0.72;
      if (bestId && bestScore >= THRESHOLD) {
        await prisma.faqQuestion.update({
          where: { id: bestId },
          data: { askedCount: { increment: 1 } }
        });
        return NextResponse.json({ ok: true, willReply: false });
      }
    }

    await prisma.faqQuestion.create({
      data: { question: q, askedCount: 1, askerEmail, askerName, askerUserId }
    });

    // Tells the page whether to promise a reply — saying "we'll get back to
    // you" to someone who left no address would be a lie.
    return NextResponse.json({ ok: true, willReply: Boolean(askerEmail) });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
