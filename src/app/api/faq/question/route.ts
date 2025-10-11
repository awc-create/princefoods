import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

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
  try {
    const body = (await req.json()) as { question?: string };
    const q = body?.question?.trim();
    if (!q) return NextResponse.json({ ok: false, error: 'EMPTY' }, { status: 400 });

    const normQ = normalize(q);

    // Load existing for grouping
    const existing = await prisma.faqQuestion.findMany({
      select: { id: true, question: true, askedCount: true, createdAt: true, updatedAt: true }
    });

    let bestId: string | null = null;
    let bestScore = 0;
    for (const row of existing) {
      const score = jaccard(normQ, normalize(row.question));
      if (score > bestScore) {
        bestScore = score;
        bestId = row.id;
      }
    }

    // threshold: group if fairly similar
    const THRESHOLD = 0.72;

    if (bestId && bestScore >= THRESHOLD) {
      await prisma.faqQuestion.update({
        where: { id: bestId },
        data: { askedCount: { increment: 1 } }
      });
    } else {
      await prisma.faqQuestion.create({
        data: { question: q, askedCount: 1 }
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
