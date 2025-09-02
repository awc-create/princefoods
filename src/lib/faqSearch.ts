import Fuse from 'fuse.js';
import { prisma } from './prisma';

type DocItem =
  | { kind: 'faq'; id: string; title: string; text: string }
  | { kind: 'policy'; id: string; title: string; text: string };

export async function searchDocs(query: string) {
  const [faqs, policies] = await Promise.all([
    prisma.faq.findMany(),
    prisma.policyDoc.findMany(),
  ]);

  const corpus: DocItem[] = [
    ...faqs.map(f => ({ kind: 'faq' as const, id: f.id, title: f.question, text: f.answer })),
    ...policies.map(p => ({ kind: 'policy' as const, id: p.id, title: p.title, text: p.body })),
  ];

  const fuse = new Fuse(corpus, {
    includeScore: true,
    shouldSort: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'text',  weight: 0.3 },
    ],
  });

  const results = fuse.search(query, { limit: 5 });
  return results.map(r => ({
    ...r.item,
    score: r.score ?? 1,
    confidence: Number((1 - (r.score ?? 1)).toFixed(2)),
  }));
}

export function buildAnswer(hits: Awaited<ReturnType<typeof searchDocs>>) {
  if (!hits.length) return { answer: "I’m not fully sure—passing this to a human.", confidence: 0 };
  const top = hits[0];
  let snippet = top.text.trim();
  if (snippet.length > 700) snippet = snippet.slice(0, 680) + '…';
  const source = top.kind === 'faq' ? `FAQ • ${top.title}` : `Policy • ${top.title}`;
  return { answer: `${snippet}\n\n[Source: ${source}]`, confidence: top.confidence };
}
