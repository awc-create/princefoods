'use client';

import Slider from '@/components/slider/Slider';
import { Oswald } from 'next/font/google';
import Link from 'next/link';
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
  secondaryCta = { label: 'Browse Shop', href: '/shop' },
  floatingTag = 'Welcome To Prince Foods',
  images = ['/assets/96bfc4_3547f98fa8f54128b23c97aa34bf83b9~mv2.avif']
}: {
  title?: string;
  subtitle?: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  floatingTag?: string;
  images?: string[];
}) {
  const slides = images.map((image) => ({
    image,
    siteLink: '',
    techStack: '',
    description: '',
    review: ''
  }));

  return (
    <section className={styles.hero} aria-labelledby="pf-hero-heading">
      <div className={styles.inner}>
        <div className={styles.left}>
          <h1 id="pf-hero-heading" className={oswald.className}>
            {title}
          </h1>
          <p>{subtitle}</p>

          <div className={styles.ctaRow}>
            <Link className={styles.ctaPrimary} href={primaryCta.href}>
              {primaryCta.label}
            </Link>
            {secondaryCta && (
              <Link className={styles.ctaGhost} href={secondaryCta.href}>
                {secondaryCta.label}
              </Link>
            )}
          </div>

          <ul className={styles.trust}>
            <li>✅ Established 2007</li>
            <li>🚚 Free delivery thresholds</li>
            <li>❄️ Insulated frozen packing</li>
          </ul>
        </div>

        <div className={styles.right}>
          <div className={styles.heroCard} aria-hidden>
            <Slider slides={slides} />
          </div>
          {floatingTag && <div className={styles.floatingTag}>{floatingTag}</div>}
        </div>
      </div>
    </section>
  );
}
