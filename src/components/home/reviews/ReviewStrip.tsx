// src/components/home/reviews/ReviewStrip.tsx
'use client';

import type { ReviewItem } from '@/types/homeSettings';
import { useMemo } from 'react';
import styles from './ReviewStrip.module.scss';

interface Props {
  autoplay?: boolean;
  showCount?: number;
  items?: ReviewItem[];
}

const FALLBACK_ITEMS: ReviewItem[] = [
  { id: 'r1', name: 'Asha', text: 'Amazing selection—my go-to for Kerala groceries.' },
  {
    id: 'r2',
    name: 'Rahul',
    text: 'Fast delivery and great prices. Frozen items arrived perfect.'
  },
  { id: 'r3', name: 'Shilpa', text: 'The spices are top quality. Reordered twice already.' },
  { id: 'r4', name: 'Ben', text: 'Reliable, friendly service since 2007—highly recommend.' }
];

export default function ReviewStrip({ autoplay = true, showCount = 4, items }: Props) {
  const data = useMemo(() => {
    const src = items && items.length > 0 ? items : FALLBACK_ITEMS;
    const n = Math.max(1, showCount);
    return src.slice(0, n);
  }, [items, showCount]);

  return (
    <section
      className={`${styles.wrap} ${autoplay ? styles.autoplay : ''}`}
      aria-labelledby="pf-reviews"
    >
      <div className={styles.inner}>
        <h2 id="pf-reviews" className={styles.title}>
          What Customers Say
        </h2>

        <div className={styles.scroller} role="list">
          {data.map((r) => (
            <blockquote key={r.id} className={styles.card} role="listitem">
              <p>“{r.text}”</p>
              <footer>— {r.name}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
