'use client';

import { Oswald } from 'next/font/google';
import Image from 'next/image';
import styles from './Hero.module.scss';

const oswald = Oswald({ weight: '500', subsets: ['latin'] });

interface Cta {
  label: string;
  href: string;
}

export default function Hero({
  title = 'South Asian Groceries, Delivered.',
  subtitle = 'Since 2007—authentic Indian & Sri Lankan favourites at everyday low prices. Premium spices, snacks, frozen specialties and more with fast UK & Ireland delivery.',
  primaryCta = { label: 'Shop Best Sellers', href: '/shop' },
  secondaryCta = { label: 'Browse Collections', href: '/collections' },
  floatingTag = 'New • Onam Favourites',
  imageUrl = '/assets/slider1.jpg'
}: {
  title?: string;
  subtitle?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  floatingTag?: string;
  imageUrl?: string;
}) {
  return (
    <section className={styles.hero} aria-labelledby="pf-hero-heading">
      <div className={styles.inner}>
        <div className={styles.left}>
          <h1 id="pf-hero-heading" className={oswald.className}>
            {title}
          </h1>
          <p>{subtitle}</p>

          <div className={styles.ctaRow}>
            <a className={styles.ctaPrimary} href={primaryCta.href}>
              {primaryCta.label}
            </a>
            <a className={styles.ctaGhost} href={secondaryCta.href}>
              {secondaryCta.label}
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
            <Image src={imageUrl} alt="" fill sizes="(max-width: 900px) 95vw, 600px" priority />
          </div>
          {floatingTag && <div className={styles.floatingTag}>{floatingTag}</div>}
        </div>
      </div>
    </section>
  );
}
