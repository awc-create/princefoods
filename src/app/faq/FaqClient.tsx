'use client';

import { useMemo, useRef, useState } from 'react';
import styles from './Faq.module.scss';

interface FAQ {
  question: string;
  answer: string;
}

const DATA: FAQ[] = [
  {
    question: 'WHAT IS YOUR RETURN POLICY?',
    answer:
      "We want you to be completely satisfied with your order. If you receive a damaged or incorrect item, please contact us within 48 hours of receiving your shipment. Please provide photographic evidence, and we'll promptly arrange a replacement or refund. Due to the perishable nature of our frozen goods, returns for reasons other than damages or errors are typically not accepted."
  },
  {
    question: 'HOW MUCH IS THE MINIMUM ORDER?',
    answer:
      'The minimum order for free delivery across the UK is just £30. Orders below this amount will incur a shipping fee.'
  },
  {
    question: 'HOW MUCH DOES SHIPPING COST?',
    answer:
      'For orders of £30 or more, delivery is free across the UK. Orders below £30 will have a shipping fee at checkout. We dispatch next working day; delivery typically in 2–3 working days. Frozen items ship next-day in insulated cartons with ice gel packs.'
  },
  {
    question: 'CAN I TRACK MY ORDER?',
    answer:
      'Yes — we’ll email you a tracking link when your order ships so you can follow it to your door.'
  },
  {
    question: 'WHAT PAYMENT METHODS DO YOU ACCEPT?',
    answer:
      'We accept major credit/debit cards (Visa, Mastercard, American Express) via Stripe. Your card details are never stored on our servers.'
  },
  {
    question: 'WHICH AREAS DO YOU DELIVER TO?',
    answer:
      'We deliver across Great Britain, Northern Ireland and the Republic of Ireland. See our Delivery page for region-specific minimums and packing fees.'
  }
];

type OpenKey = null | `${'L' | 'R'}-${number}`;

export default function FaqClient() {
  // Split into two independent columns so one side expanding
  // doesn't stretch the other column.
  const left = useMemo(() => DATA.filter((_, i) => i % 2 === 0), []);
  const right = useMemo(() => DATA.filter((_, i) => i % 2 === 1), []);

  // NOTE: sections are <section> elements -> HTMLElement, not HTMLDivElement.
  const refsL = useRef<Array<HTMLElement | null>>([]);
  const refsR = useRef<Array<HTMLElement | null>>([]);

  const [open, setOpen] = useState<OpenKey>('L-0');
  const isOpen = (col: 'L' | 'R', i: number) => open === `${col}-${i}`;

  function toggle(col: 'L' | 'R', i: number) {
    const key: OpenKey = `${col}-${i}`;
    setOpen((prev) => (prev === key ? null : key));

    // Small screens: bring into view smoothly
    if (typeof window !== 'undefined' && window.innerWidth < 900) {
      const el = (col === 'L' ? refsL : refsR).current[i];
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.head}>
        <h1 className={styles.title}>FAQs and their answers</h1>
        <p className={styles.sub}>Browse some of our most asked questions</p>
      </header>

      <div className={styles.cols}>
        {/* Left column */}
        <div className={styles.col} role="list">
          {left.map((f, i) => {
            const expanded = isOpen('L', i);
            const id = `faq-L-${i}`;
            return (
              <section
                key={id}
                // ✅ Ref callback returns void + correct element type
                ref={(el) => {
                  refsL.current[i] = el;
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
                    onClick={() => toggle('L', i)}
                  >
                    <span className={styles.q}>{f.question}</span>
                    <span className={styles.chev} aria-hidden />
                  </button>
                </h2>
                <div
                  id={`${id}-panel`}
                  className={styles.panel}
                  role="region"
                  aria-labelledby={id}
                  hidden={!expanded}
                >
                  <div className={styles.panelInner}>
                    <p className={styles.answer}>{f.answer}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>

        {/* Right column */}
        <div className={styles.col} role="list">
          {right.map((f, i) => {
            const expanded = isOpen('R', i);
            const id = `faq-R-${i}`;
            return (
              <section
                key={id}
                // ✅ Ref callback returns void + correct element type
                ref={(el) => {
                  refsR.current[i] = el;
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
                    onClick={() => toggle('R', i)}
                  >
                    <span className={styles.q}>{f.question}</span>
                    <span className={styles.chev} aria-hidden />
                  </button>
                </h2>
                <div
                  id={`${id}-panel`}
                  className={styles.panel}
                  role="region"
                  aria-labelledby={id}
                  hidden={!expanded}
                >
                  <div className={styles.panelInner}>
                    <p className={styles.answer}>{f.answer}</p>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
