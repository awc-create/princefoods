'use client';

import type { ReviewItem } from '@/types/homeSettings';
import { motion, useAnimationFrame, useMotionValue, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import styles from './ReviewStrip.module.scss';

interface Props {
  autoplay?: boolean;
  showCount?: number;
  items?: ReviewItem[];
}

const FALLBACK_ITEMS: ReviewItem[] = [
  {
    id: 'r1',
    name: 'Asha',
    text: 'Amazing selection — my go-to for Kerala groceries. Nothing beats the authentic taste.'
  },
  {
    id: 'r2',
    name: 'Rahul',
    text: 'Fast delivery and great prices. Frozen items arrived perfectly insulated.'
  },
  {
    id: 'r3',
    name: 'Shilpa',
    text: "The spices are top quality. Reordered twice already and won't go anywhere else."
  },
  {
    id: 'r4',
    name: 'Ben',
    text: 'Reliable, friendly service since 2007. Highly recommend to anyone who loves South Asian food.'
  },
  {
    id: 'r5',
    name: 'Priya',
    text: 'The chapathi and murukku are exactly like back home. Delivery was super fast too!'
  },
  {
    id: 'r6',
    name: 'James',
    text: 'Incredible variety and very reasonable prices. My whole family loves ordering here.'
  }
];

const CARD_W = 316; // card width + gap

function StarRow() {
  return (
    <div className={styles.stars} aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ r }: { r: ReviewItem }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <StarRow />
        <span className={styles.quoteIcon}>"</span>
      </div>
      <p className={styles.text}>{r.text}</p>
      <footer className={styles.author}>
        <span className={styles.avatar}>{r.name[0].toUpperCase()}</span>
        <span className={styles.name}>{r.name}</span>
      </footer>
    </div>
  );
}

export default function ReviewStrip({ autoplay = true, showCount = 6, items }: Props) {
  const src = items && items.length > 0 ? items : FALLBACK_ITEMS;
  const data = src.slice(0, Math.max(1, showCount));
  const looped = [...data, ...data, ...data, ...data];

  const x = useMotionValue(0);
  const pausedRef = useRef(false);
  const [isPaused, setIsPaused] = useState(false);
  const totalW = data.length * CARD_W;
  const SPEED = 0.03;

  useAnimationFrame((_, delta) => {
    if (!autoplay || pausedRef.current) return;
    let next = x.get() - delta * SPEED;
    if (next <= -totalW) next += totalW;
    x.set(next);
  });

  const translateX = useTransform(x, (v) => `${v}px`);

  const nudge = (dir: 1 | -1) => {
    x.set(x.get() + dir * -CARD_W);
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setIsPaused(pausedRef.current);
  };

  return (
    <section className={styles.wrap} aria-labelledby="pf-reviews">
      <motion.div
        className={styles.header}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        <div className={styles.eyebrow}>★ Verified customers</div>
        <h2 id="pf-reviews" className={styles.title}>
          What Our Customers Say
        </h2>
        <p className={styles.sub}>Trusted by thousands of South Asian food lovers across the UK.</p>
      </motion.div>

      {/* Manual controls */}
      <div className={styles.controls}>
        <button
          className={styles.ctrlBtn}
          onClick={() => nudge(-1)}
          aria-label="Previous reviews"
          type="button"
        >
          ‹
        </button>
        <button
          className={`${styles.ctrlBtn} ${styles.pauseBtn}`}
          onClick={togglePause}
          type="button"
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          className={styles.ctrlBtn}
          onClick={() => nudge(1)}
          aria-label="Next reviews"
          type="button"
        >
          ›
        </button>
      </div>

      <div
        className={styles.track}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          if (!isPaused) pausedRef.current = false;
        }}
      >
        <motion.div className={styles.inner} style={{ x: translateX }}>
          {looped.map((r, i) => (
            <ReviewCard key={`${r.id}-${i}`} r={r} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
