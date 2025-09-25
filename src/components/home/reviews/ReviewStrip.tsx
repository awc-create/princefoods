'use client';

import styles from './ReviewStrip.module.scss';

const REVIEWS = [
  { name: 'Asha', text: 'Amazing selection—my go-to for Kerala groceries.' },
  { name: 'Rahul', text: 'Fast delivery and great prices. Frozen items arrived perfect.' },
  { name: 'Shilpa', text: 'The spices are top quality. Reordered twice already.' },
  { name: 'Ben', text: 'Reliable, friendly service since 2007—highly recommend.' }
];

export default function ReviewStrip() {
  return (
    <section className={styles.wrap} aria-labelledby="pf-reviews">
      <div className={styles.inner}>
        <h2 id="pf-reviews" className={styles.title}>
          What Customers Say
        </h2>
        <div className={styles.scroller} role="list">
          {REVIEWS.map((r, i) => (
            <blockquote key={i} className={styles.card} role="listitem">
              <p>“{r.text}”</p>
              <footer>— {r.name}</footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
