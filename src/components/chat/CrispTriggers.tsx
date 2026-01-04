// src/components/chat/CrispTriggers.tsx
'use client';

import { crispPush, crispSessionEvent } from '@/lib/crisp';
import { useEffect, useRef } from 'react';

type Intent =
  | 'wholesale_intent'
  | 'delivery_intent'
  | 'returns_refunds_intent'
  | 'payment_issues_intent'
  | 'stock_intent';

function classifyIntent(text: string): Intent | null {
  const t = text.toLowerCase();

  if (/(wholesale|bulk|trade|reseller|business|restaurant)/i.test(t)) return 'wholesale_intent';

  if (
    /(delivery|shipping|ship|tracking|track|courier|apc|next day|next-day|frozen|ice pack|ice packs)/i.test(
      t
    )
  )
    return 'delivery_intent';

  if (
    /(return|refund|exchange|cancel|wrong item|missing item|damaged|broken|leak|leaking|defrosted)/i.test(
      t
    )
  )
    return 'returns_refunds_intent';

  if (
    /(payment|paid|card|stripe|paypal|declined|failed|error|charged|charge|billing|checkout)/i.test(
      t
    )
  )
    return 'payment_issues_intent';

  if (/(stock|in stock|out of stock|availability|available|restock|back in|when back)/i.test(t))
    return 'stock_intent';

  return null;
}

function safePathname(): string {
  try {
    return window.location?.pathname ?? '/';
  } catch {
    return '/';
  }
}

function extractMessageContent(msg: unknown): string {
  if (!msg || typeof msg !== 'object') return '';
  const rec = msg as Record<string, unknown>;

  const direct = rec.content;
  if (typeof direct === 'string') return direct;

  const text = rec.text;
  if (typeof text === 'string') return text;

  const message = rec.message;
  if (typeof message === 'string') return message;

  return '';
}

export default function CrispTriggers() {
  const wired = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (wired.current) return;
    wired.current = true;

    window.$crisp = window.$crisp ?? [];

    console.log('[CrispTriggers] wiring listeners…');

    crispPush([
      'on',
      'chat:opened',
      () => {
        const path = safePathname();
        console.log('[CrispTriggers] chat:opened -> session:event "chat_opened"', { path });
        crispSessionEvent('chat_opened', { path }, 'blue');
      }
    ]);

    crispPush([
      'on',
      'message:sent',
      (msg: unknown) => {
        const path = safePathname();
        const content = extractMessageContent(msg).trim();

        console.log('[CrispTriggers] message:sent raw=', msg);
        console.log('[CrispTriggers] message:sent content=', content);

        const intent = classifyIntent(content);
        console.log('[CrispTriggers] message:sent intent=', intent);

        if (!intent) return;

        console.log('[CrispTriggers] emitting session:event', { event: intent, path, content });
        crispSessionEvent(intent, { path, content }, 'green');
      }
    ]);

    crispPush([
      'on',
      'message:received',
      (msg: unknown) => {
        console.log('[CrispTriggers] message:received raw=', msg);
      }
    ]);

    console.log('[CrispTriggers] listeners wired ✅');
  }, []);

  return null;
}
