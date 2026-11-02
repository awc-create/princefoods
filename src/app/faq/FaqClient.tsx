'use client';

import type { FAQSettingsDTO } from '@/types/faqSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './Faq.module.scss';

type Col = 'L' | 'R';
type OpenKey = null | `${Col}-${number}`;

function highlight(text: string, q: string) {
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className={styles.hl}>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface SignedInAs {
  email: string;
  name: string;
}

export default function FaqClient({
  initial,
  signedInAs = null
}: {
  initial: FAQSettingsDTO;
  signedInAs?: SignedInAs | null;
}) {
  const [heading] = useState(initial.heading);
  const [subheading] = useState(initial.subheading ?? '');
  const [items] = useState(initial.items);

  // Split in two columns (stable by index)
  const left = useMemo(() => items.filter((_, i) => i % 2 === 0), [items]);
  const right = useMemo(() => items.filter((_, i) => i % 2 === 1), [items]);

  const refsL = useRef<Array<HTMLElement | null>>([]);
  const refsR = useRef<Array<HTMLElement | null>>([]);
  const panelRefsL = useRef<Array<HTMLDivElement | null>>([]);
  const panelRefsR = useRef<Array<HTMLDivElement | null>>([]);

  const [open, setOpen] = useState<OpenKey>('L-0');
  const [query, setQuery] = useState('');
  const [ask, setAsk] = useState<{
    state: 'idle' | 'sending' | 'sent' | 'error';
    message: string;
  }>({ state: 'idle', message: '' });
  const isOpen = (col: Col, i: number) => open === `${col}-${i}`;

  // Deep-link open on load & when hash changes
  useEffect(() => {
    const tryOpenFromHash = () => {
      const h = window.location.hash.replace('#', '');
      if (!h) return;
      if (/^(faq-[LR]-\d+)$/.test(h)) {
        const [, col, idx] = h.split('-'); // faq, L|R, N
        setOpen(`${col as Col}-${Number(idx)}`);
        setTimeout(() => {
          document.getElementById(h)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
      }
    };
    tryOpenFromHash();
    window.addEventListener('hashchange', tryOpenFromHash);
    return () => window.removeEventListener('hashchange', tryOpenFromHash);
  }, []);

  function toggle(col: Col, i: number) {
    const key: OpenKey = `${col}-${i}`;
    const prev = open;
    setOpen(prev === key ? null : key);

    // Animate height via measurement
    const panels = col === 'L' ? panelRefsL.current : panelRefsR.current;
    const el = panels[i];
    if (!el) return;

    const start = el.style.maxHeight || '0px';
    const end = prev === key ? '0px' : `${el.scrollHeight}px`;
    el.style.maxHeight = start;
    requestAnimationFrame(() => {
      el.style.maxHeight = end;
    });

    // Small screens: bring into view
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      (col === 'L' ? refsL : refsR).current[i]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }

    // Update hash for shareable deep-link
    history.replaceState(null, '', `#faq-${key}`);
  }

  // Keyboard nav: ↑/↓ move between items, Enter/Space toggles
  function onKey(col: Col, i: number, e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(col, i);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const arr = col === 'L' ? left : right;
      const next = e.key === 'ArrowDown' ? Math.min(i + 1, arr.length - 1) : Math.max(i - 1, 0);
      const btn = document.getElementById(`faq-${col}-${next}`) as HTMLButtonElement | null;
      btn?.focus();
    }
  }

  // Filter by query (both cols separately so layout balance stays)
  const fl = useMemo(
    () =>
      left.filter((x) => `${x.question} ${x.answer}`.toLowerCase().includes(query.toLowerCase())),
    [left, query]
  );
  const fr = useMemo(
    () =>
      right.filter((x) => `${x.question} ${x.answer}`.toLowerCase().includes(query.toLowerCase())),
    [right, query]
  );

  async function submitQuestion(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const question = String(fd.get('q') ?? '').trim();

    if (!question) {
      setAsk({ state: 'error', message: 'Please type a question first.' });
      return;
    }

    const email = String(fd.get('email') ?? '').trim();
    const name = String(fd.get('name') ?? '').trim();

    setAsk({ state: 'sending', message: '' });
    try {
      const res = await fetch('/api/faq/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, email, name })
      });

      // fetch() does NOT throw on 4xx/5xx — without this check a rejected or
      // rate-limited question still told the customer it had been received.
      if (!res.ok) {
        const msg =
          res.status === 429
            ? 'You’ve sent a few questions already. Please try again in a little while.'
            : res.status === 400
              ? 'That email address doesn’t look right — please check it, or leave it blank.'
              : 'Sorry, we couldn’t send that just now. Please try again later.';
        setAsk({ state: 'error', message: msg });
        return;
      }

      const json = (await res.json().catch(() => ({}))) as { willReply?: boolean };
      form.reset();
      setAsk({
        state: 'sent',
        // Only promise a reply when there's somewhere to send one.
        message: json.willReply
          ? 'Thanks — we’ve got your question and we’ll reply by email.'
          : 'Thanks — we’ve received your question. Add an email next time if you’d like a reply.'
      });
    } catch {
      setAsk({
        state: 'error',
        message: 'Sorry, we couldn’t send that just now. Please check your connection.'
      });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.head}>
          <h1 className={styles.title}>{heading}</h1>
          {subheading && <p className={styles.sub}>{subheading}</p>}

          <div className={styles.tools}>
            <input
              className={styles.search}
              type="search"
              placeholder="Search questions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search FAQs"
            />
          </div>
        </header>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No questions published yet</p>
            <p className={styles.emptyText}>
              We&rsquo;re still putting this page together. If there&rsquo;s something you&rsquo;d
              like to know, ask below and we&rsquo;ll get back to you.
            </p>
          </div>
        ) : fl.length + fr.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No questions match &ldquo;{query}&rdquo;</p>
            <p className={styles.emptyText}>
              Try a different word, or ask us directly using the box below.
            </p>
            <button type="button" className={styles.emptyBtn} onClick={() => setQuery('')}>
              Clear search
            </button>
          </div>
        ) : null}

        <div className={styles.cols}>
          {/* Left column */}
          <div className={styles.col} role="list">
            {fl.map((f) => {
              const gi = left.indexOf(f);
              const expanded = isOpen('L', gi);
              const id = `faq-L-${gi}`;
              return (
                <section
                  key={id}
                  ref={(el) => {
                    refsL.current[gi] = el;
                  }}
                  className={`${styles.item} ${expanded ? styles.expanded : ''}`}
                  role="listitem"
                >
                  <h2 className={styles.h2}>
                    <button
                      id={id}
                      className={styles.trigger}
                      aria-expanded={expanded}
                      aria-controls={`${id}-panel`}
                      onClick={() => toggle('L', gi)}
                      onKeyDown={(e) => onKey('L', gi, e)}
                    >
                      <span className={styles.q}>{highlight(f.question, query)}</span>
                      <span className={styles.chev} aria-hidden />
                    </button>
                  </h2>

                  <div
                    id={`${id}-panel`}
                    className={`${styles.panel} ${expanded ? styles.opening : ''}`}
                    role="region"
                    aria-labelledby={id}
                    ref={(el) => {
                      panelRefsL.current[gi] = el;
                    }}
                    style={{ maxHeight: expanded ? undefined : '0px' }}
                  >
                    <div className={styles.panelInner}>
                      <p className={styles.answer}>{highlight(f.answer, query)}</p>

                      <div className={styles.rowRight}>
                        <button
                          className={styles.linkBtn}
                          type="button"
                          onClick={() => {
                            const hash = `#faq-L-${gi}`;
                            history.replaceState(null, '', hash);
                            navigator.clipboard?.writeText(
                              `${location.origin}${location.pathname}${hash}`
                            );
                          }}
                          aria-label="Copy link to this answer"
                          title="Copy link"
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Right column */}
          <div className={styles.col} role="list">
            {fr.map((f) => {
              const gi = right.indexOf(f);
              const expanded = isOpen('R', gi);
              const id = `faq-R-${gi}`;
              return (
                <section
                  key={id}
                  ref={(el) => {
                    refsR.current[gi] = el;
                  }}
                  className={`${styles.item} ${expanded ? styles.expanded : ''}`}
                  role="listitem"
                >
                  <h2 className={styles.h2}>
                    <button
                      id={id}
                      className={styles.trigger}
                      aria-expanded={expanded}
                      aria-controls={`${id}-panel`}
                      onClick={() => toggle('R', gi)}
                      onKeyDown={(e) => onKey('R', gi, e)}
                    >
                      <span className={styles.q}>{highlight(f.question, query)}</span>
                      <span className={styles.chev} aria-hidden />
                    </button>
                  </h2>

                  <div
                    id={`${id}-panel`}
                    className={`${styles.panel} ${expanded ? styles.opening : ''}`}
                    role="region"
                    aria-labelledby={id}
                    ref={(el) => {
                      panelRefsR.current[gi] = el;
                    }}
                    style={{ maxHeight: expanded ? undefined : '0px' }}
                  >
                    <div className={styles.panelInner}>
                      <p className={styles.answer}>{highlight(f.answer, query)}</p>
                      <div className={styles.rowRight}>
                        <button
                          className={styles.linkBtn}
                          type="button"
                          onClick={() => {
                            const hash = `#faq-R-${gi}`;
                            history.replaceState(null, '', hash);
                            navigator.clipboard?.writeText(
                              `${location.origin}${location.pathname}${hash}`
                            );
                          }}
                          aria-label="Copy link to this answer"
                          title="Copy link"
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        {/* Ask-a-question box */}
        <form className={styles.ask} onSubmit={submitQuestion}>
          <h3 className={styles.askTitle}>Didn’t find what you need?</h3>
          <div className={styles.askRow}>
            <input
              name="q"
              className={styles.askInput}
              placeholder="Ask us a question…"
              maxLength={500}
              disabled={ask.state === 'sending'}
            />
            <button className={styles.askBtn} disabled={ask.state === 'sending'}>
              {ask.state === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>

          {signedInAs ? (
            <p className={styles.askHelp}>
              We’ll reply to <strong>{signedInAs.email}</strong>, and you’ll find the answer in
              your account under Messages.
            </p>
          ) : (
            <div className={styles.askContact}>
              <input
                name="name"
                className={styles.askInput}
                placeholder="Your name (optional)"
                maxLength={80}
                autoComplete="name"
                disabled={ask.state === 'sending'}
              />
              <input
                name="email"
                type="email"
                className={styles.askInput}
                placeholder="Your email (optional — for a reply)"
                maxLength={254}
                autoComplete="email"
                disabled={ask.state === 'sending'}
              />
            </div>
          )}

          {ask.message && (
            <p
              className={`${styles.askStatus} ${
                ask.state === 'error' ? styles.askErr : styles.askOk
              }`}
              role="status"
            >
              {ask.message}
            </p>
          )}

          <p className={styles.askHelp}>
            Leave an email and we’ll answer you directly. Popular questions may also be added to
            this page.
          </p>
        </form>
      </div>
    </div>
  );
}
