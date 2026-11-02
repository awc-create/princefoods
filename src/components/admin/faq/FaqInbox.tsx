'use client';

/**
 * Admin inbox for questions submitted through the public FAQ page.
 *
 * Before this, the inbox could only show the question text and an "add to
 * FAQs" button — there was no way to reply to the person who asked. Each row
 * now opens into a reply box that saves the answer, emails the asker, and can
 * publish the Q&A to the public FAQ in the same step.
 *
 * The published wording is a separate field, pre-filled from what the customer
 * typed. Real questions arrive as "do u deliver to glasgow??" and that is not
 * what should appear on the page.
 */

import type { FAQInboxItem, FAQQuestionStatus } from '@/types/faqSettings';
import { useMemo, useState } from 'react';
import styles from './FaqInbox.module.scss';

type Filter = 'open' | 'answered' | 'all';

interface AnswerResponse {
  ok: boolean;
  error?: string;
  emailed?: boolean;
  hasEmail?: boolean;
  emailError?: string | null;
  published?: boolean;
}

function when(ms: number): string {
  return new Date(ms).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

const STATUS_LABEL: Record<FAQQuestionStatus, string> = {
  NEW: 'Needs an answer',
  ANSWERED: 'Answered',
  DISMISSED: 'Dismissed'
};

export default function FaqInbox({
  items,
  onChanged
}: {
  items: FAQInboxItem[];
  /** Reload the page data after a question changes. */
  onChanged: () => void | Promise<void>;
}) {
  const [filter, setFilter] = useState<Filter>('open');
  const [openId, setOpenId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      open: items.filter((q) => q.status === 'NEW').length,
      answered: items.filter((q) => q.status === 'ANSWERED').length,
      all: items.length
    }),
    [items]
  );

  const shown = useMemo(() => {
    if (filter === 'open') return items.filter((q) => q.status === 'NEW');
    if (filter === 'answered') return items.filter((q) => q.status === 'ANSWERED');
    return items;
  }, [items, filter]);

  return (
    <div className={styles.wrap}>
      <div className={styles.filters} role="tablist" aria-label="Filter questions">
        {(['open', 'answered', 'all'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={`${styles.filter} ${filter === f ? styles.filterOn : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'open' ? 'Needs an answer' : f === 'answered' ? 'Answered' : 'Everything'}
            <span className={styles.count}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className={styles.empty}>
          {filter === 'open'
            ? 'Nothing waiting — every question has been dealt with.'
            : 'Nothing here yet.'}
        </div>
      ) : (
        <ul className={styles.list}>
          {shown.map((q) => (
            <InboxRow
              key={q.id}
              q={q}
              open={openId === q.id}
              onToggle={() => setOpenId(openId === q.id ? null : q.id)}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxRow({
  q,
  open,
  onToggle,
  onChanged
}: {
  q: FAQInboxItem;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [answer, setAnswer] = useState(q.answer ?? '');
  const [publish, setPublish] = useState(q.published);
  const [publicQuestion, setPublicQuestion] = useState(q.question);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null);

  const canReply = Boolean(q.askerEmail) || q.hasAccount;

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/site/faq/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: q.id, ...payload })
      });
      const json = (await res.json()) as AnswerResponse;

      if (!res.ok || !json.ok) {
        setResult({ kind: 'err', text: json.error ?? 'That didn’t save. Please try again.' });
        return;
      }

      // Saved — but say plainly whether the customer was actually contacted.
      if (payload.dismiss) {
        setResult({ kind: 'ok', text: 'Dismissed.' });
      } else if (json.emailError) {
        setResult({
          kind: 'warn',
          text: `Answer saved, but the email didn’t send: ${json.emailError}`
        });
      } else if (json.emailed) {
        setResult({ kind: 'ok', text: 'Answer saved and emailed.' });
      } else if (!json.hasEmail) {
        setResult({
          kind: 'warn',
          text: 'Answer saved. This person left no email, so nothing was sent to them.'
        });
      } else {
        setResult({ kind: 'ok', text: 'Answer saved.' });
      }

      await onChanged();
    } catch {
      setResult({ kind: 'err', text: 'Couldn’t reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={`${styles.row} ${open ? styles.rowOpen : ''}`}>
      <button type="button" className={styles.head} onClick={onToggle} aria-expanded={open}>
        <span className={styles.headMain}>
          <span className={styles.question}>{q.question}</span>
          <span className={styles.meta}>
            <span className={`${styles.pill} ${styles[`pill${q.status}`]}`}>
              {STATUS_LABEL[q.status]}
            </span>
            {q.askedCount > 1 && <span>Asked {q.askedCount}×</span>}
            <span>
              {/* `||` not `??`: an empty stored name should fall through to the
                email rather than render as a blank gap. */}
            {/* eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing */}
            {q.askerName || q.askerEmail || 'Anonymous'}
              {q.hasAccount && ' · has an account'}
            </span>
            <time>{when(q.createdAt)}</time>
          </span>
        </span>
        <span className={styles.chev} aria-hidden>
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className={styles.body}>
          {!canReply && (
            <p className={styles.note}>
              This question was asked anonymously, so there is nobody to reply to. You can still
              publish an answer to the FAQ page below, or dismiss it.
            </p>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Your answer</span>
            <textarea
              className={styles.textarea}
              rows={5}
              maxLength={5000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write the answer as you'd say it to the customer…"
            />
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            <span>Also add this to the public FAQ page</span>
          </label>

          {publish && (
            <label className={styles.field}>
              <span className={styles.label}>
                How the question should read on the FAQ page
              </span>
              <input
                className={styles.input}
                maxLength={500}
                value={publicQuestion}
                onChange={(e) => setPublicQuestion(e.target.value)}
              />
              <span className={styles.hint}>
                Tidy up the wording — customers often type in shorthand, and this is what
                visitors will see.
              </span>
            </label>
          )}

          {result && (
            <p
              className={`${styles.result} ${
                result.kind === 'err'
                  ? styles.resultErr
                  : result.kind === 'warn'
                    ? styles.resultWarn
                    : styles.resultOk
              }`}
              role="status"
            >
              {result.text}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !answer.trim()}
              onClick={() => void send({ answer, publish, publicQuestion })}
            >
              {busy
                ? 'Saving…'
                : canReply
                  ? publish
                    ? 'Send answer & publish'
                    : 'Send answer'
                  : publish
                    ? 'Save & publish'
                    : 'Save answer'}
            </button>

            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() => void send({ dismiss: true })}
            >
              Dismiss
            </button>
          </div>

          {q.answeredAt && (
            <p className={styles.history}>
              Last answered {when(q.answeredAt)}
              {q.answeredByEmail ? ` by ${q.answeredByEmail}` : ''}
              {q.published ? ' · published to the FAQ page' : ''}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
