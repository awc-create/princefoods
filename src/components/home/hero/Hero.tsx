'use client';

import { Oswald } from 'next/font/google';
import Image from 'next/image';
import styles from './Hero.module.scss';

const oswald = Oswald({ weight: '500', subsets: ['latin'] });

export default function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="pf-hero-heading">
      <div className={styles.inner}>
        <div className={styles.left}>
          <h1 id="pf-hero-heading" className={oswald.className}>
            South Asian Groceries, Delivered.
          </h1>
          <p>
            Since 2007—authentic Indian &amp; Sri Lankan favourites at everyday low prices. Premium
            spices, snacks, frozen specialties and more with fast UK &amp; Ireland delivery.
          </p>

          <div className={styles.ctaRow}>
            <a className={styles.ctaPrimary} href="/shop">
              Shop Best Sellers
            </a>
            <a className={styles.ctaGhost} href="/collections">
              Browse Collections
            </a>
          </div>

          <ul className={styles.trust}>
            <li>✅ Established 2007</li>
            <li>🚚 Free delivery thresholds</li>
            <li>❄️ Insulated frozen packing</li>
          </ul>
        </div>

        <div className={styles.right}>
          <div className={styles.heroCard} aria-hidden>
            <Image
              src="/assets/slider1.jpg"
              alt=""
              fill
              sizes="(max-width: 900px) 95vw, 600px"
              priority
            />
          </div>
          <div className={styles.floatingTag}>New • Onam Favourites</div>
        </div>
      </div>
    </section>
  );
}
