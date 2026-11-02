'use client';

/**
 * Questions this customer has asked through the FAQ page, and the answers.
 *
 * Opening the tab marks answered messages as read, which is what clears the
 * unread dot in the tab bar — the customer has, by definition, just seen them.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './MessagesTab.module.scss';

interface Message {
  id: string;
  question: string;
  answer: string | null;
  askedAt: number;
  answeredAt: number | null;
  unread: boolean;
}

function when(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

export default function MessagesTab({ onRead }: { onRead?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/account/messages', { cache: 'no-store' });
        const json = (await res.json()) as { ok: boolean; messages?: Message[] };
        if (cancelled) return;

        if (!res.ok || !json.ok) {
          setState('error');
          return;
        }

        setMessages(json.messages ?? []);
        setState('ready');

        // Clear the unread flag only once they're actually on screen.
        if ((json.messages ?? []).some((m) => m.unread)) {
          await fetch('/api/account/messages', { method: 'POST' });
          onRead?.();
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onRead]);

  if (state === 'loading') return <p className={styles.muted}>Loading your messages…</p>;

  if (state === 'error') {
    return (
      <p className={styles.muted}>
        We couldn’t load your messages just now. Please refresh, or email{' '}
        <a href="mailto:support@prince-foods.com">support@prince-foods.com</a>.
      </p>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={styles.empty}>
        <h3 className={styles.emptyTitle}>No messages yet</h3>
        <p className={styles.muted}>
          Ask us anything on the <Link href="/faq">FAQ page</Link> and the answer will appear
          here, as well as in your inbox.
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.list}>
      {messages.map((m) => (
        <li key={m.id} className={`${styles.item} ${m.unread ? styles.itemUnread : ''}`}>
          <div className={styles.block}>
            <span className={styles.tag}>You asked</span>
            <p className={styles.question}>{m.question}</p>
            <time className={styles.date}>{when(m.askedAt)}</time>
          </div>

          {m.answer ? (
            <div className={`${styles.block} ${styles.reply}`}>
              <span className={styles.tag}>
                Prince Foods replied
                {m.unread && <span className={styles.newDot}>New</span>}
              </span>
              <p className={styles.answer}>{m.answer}</p>
              {m.answeredAt && <time className={styles.date}>{when(m.answeredAt)}</time>}
            </div>
          ) : (
            <p className={styles.pending}>We’ve got this one — we’ll reply as soon as we can.</p>
          )}
        </li>
      ))}
    </ul>
  );
}
