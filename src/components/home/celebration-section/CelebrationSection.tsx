'use client';

import ProductSlider from '@/components/products/ProductSlider';
import { motion } from 'framer-motion';
import Link from 'next/link';
import layout from './CelebrationSection.module.scss';
import themes from './celebrationSectionThemes.module.scss';

interface SliderProduct {
  id: string;
  name: string;
  price: number;
  productImageUrl: string | null;
}

type CelebrationKey =
  | 'onam'
  | 'vishu'
  | 'diwali'
  | 'pongal'
  | 'ramadan_eid'
  | 'easter'
  | 'christmas'
  | 'new_year'
  | 'summer_bbq'
  | 'back_to_uni'
  | 'custom';

function themeClass(key?: string | null) {
  switch (key as CelebrationKey) {
    case 'ramadan_eid':
      return themes.themeRamadan;
    case 'diwali':
      return themes.themeDiwali;
    case 'christmas':
      return themes.themeChristmas;
    case 'onam':
      return themes.themeOnam;
    case 'vishu':
      return themes.themeVishu;
    case 'pongal':
      return themes.themePongal;
    case 'easter':
      return themes.themeEaster;
    case 'new_year':
      return themes.themeNewYear;
    case 'summer_bbq':
      return themes.themeSummer;
    case 'back_to_uni':
      return themes.themeUni;
    default:
      return themes.themeDefault;
  }
}

export default function CelebrationSection({
  celebrationKey,
  badge,
  title,
  description,
  imageUrl,
  ctaLabel,
  ctaHref,
  backgroundColor,
  products
}: {
  celebrationKey?: string | null;
  badge?: string | null;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  backgroundColor?: string | null;
  products: SliderProduct[];
}) {
  const hasImage = Boolean(imageUrl?.trim());
  const theme = themeClass(celebrationKey);

  return (
    <section
      className={`${layout.section} ${theme}`}
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      <div className={layout.inner}>
        <div className={layout.hero}>
          <motion.div
            className={layout.copy}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {badge ? <span className={layout.badge}>{badge}</span> : null}

            <h2>{title}</h2>

            {description ? <p>{description}</p> : null}

            {ctaLabel && ctaHref ? (
              <Link href={ctaHref} className={layout.cta}>
                {ctaLabel}
              </Link>
            ) : null}
          </motion.div>

          <motion.div
            className={layout.mediaWrap}
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
          >
            {hasImage ? (
              <div className={layout.mediaCard}>
                <div className={layout.mediaGlow} />
                <div className={layout.imageFrame}>
                  <div className={layout.imageMat}>
                    <img src={imageUrl ?? ''} alt={title} className={layout.image} />
                  </div>
                </div>
              </div>
            ) : (
              <div className={layout.mediaPlaceholder}>
                <div className={layout.placeholderInner}>
                  <span className={layout.placeholderEyebrow}>Campaign visual</span>
                  <strong>No campaign image yet</strong>
                  <small>Add one from the admin panel to bring this section to life.</small>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {products.length > 0 ? (
          <motion.div
            className={layout.productsBlock}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.05 }}
          >
            <div className={layout.productsHeader}>
              <h3>Featured in this collection</h3>
              <p>Curated festive favourites.</p>
            </div>

            <div className={layout.sliderShell}>
              <ProductSlider title="" subtitle={undefined} products={products} />
            </div>
          </motion.div>
        ) : null}
      </div>
    </section>
  );
}
