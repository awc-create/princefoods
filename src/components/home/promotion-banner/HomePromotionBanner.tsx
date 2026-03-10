'use client';

import { motion } from 'framer-motion';
import { Check, Copy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import styles from './HomePromotionBanner.module.scss';

export default function HomePromotionBanner({
  title,
  message,
  ctaLabel,
  ctaHref,
  backgroundImageUrl,
  promoCode
}: {
  title: string;
  message?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
  backgroundImageUrl?: string | null;
  promoCode?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!promoCode) return;

    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const hasImage = Boolean(backgroundImageUrl?.trim());

  return (
    <motion.section
      className={`${styles.banner} ${hasImage ? styles.bannerWithImage : ''}`}
      style={
        hasImage
          ? {
              backgroundImage: `
                linear-gradient(90deg, rgba(18, 18, 28, 0.82) 0%, rgba(39, 35, 58, 0.76) 45%, rgba(39, 35, 58, 0.82) 100%),
                url(${backgroundImageUrl})
              `
            }
          : undefined
      }
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
    >
      <div className={styles.inner}>
        <div className={styles.content}>
          <div className={styles.copyBlock}>
            <motion.div
              className={styles.textWrap}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: 'easeOut' }}
            >
              <span className={styles.kicker}>Special offer</span>
              <h2>{title}</h2>
              {message ? <p>{message}</p> : null}
            </motion.div>

            {promoCode ? (
              <motion.button
                type="button"
                className={`${styles.codePill} ${copied ? styles.codePillCopied : ''}`}
                onClick={handleCopy}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.1, ease: 'easeOut' }}
                aria-label={`Copy promo code ${promoCode}`}
                title={copied ? 'Copied' : `Copy code ${promoCode}`}
              >
                <span className={styles.codeLabel}>Code</span>
                <span className={styles.codeValue}>{promoCode}</span>
                <span className={styles.codeIcon}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </span>
              </motion.button>
            ) : null}
          </div>

          {ctaLabel && ctaHref ? (
            <motion.div
              className={styles.ctaWrap}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.12, ease: 'easeOut' }}
            >
              <Link href={ctaHref} className={styles.cta}>
                {ctaLabel}
              </Link>
            </motion.div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}
