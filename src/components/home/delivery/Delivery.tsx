'use client';

import { motion } from 'framer-motion';
import { Snowflake, Truck, Zap } from 'lucide-react';
import styles from './Delivery.module.scss';

export interface DeliveryCard {
  id: string;
  title: string;
  freeThreshold: number;
  frozenFee: number;
  message?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.12, ease: 'easeOut' as const }
  })
};

const lineGrow = {
  hidden: { scaleX: 0 },
  show: {
    scaleX: 1,
    transition: { duration: 0.7, delay: 0.2, ease: 'easeOut' as const }
  }
};

export default function Delivery({
  cards,
  gbFreeThreshold = 30,
  niFreeThreshold = 40,
  frozenFee = 3.99,
  message = 'No hidden fees. Frozen items are insulated for freshness.'
}: {
  cards?: DeliveryCard[];
  gbFreeThreshold?: number;
  niFreeThreshold?: number;
  frozenFee?: number;
  message?: string;
}) {
  const list: DeliveryCard[] =
    cards && cards.length > 0
      ? cards
      : [
          { id: 'gb', title: 'Great Britain', freeThreshold: gbFreeThreshold, frozenFee },
          { id: 'ni', title: 'Northern Ireland', freeThreshold: niFreeThreshold, frozenFee }
        ];

  return (
    <section className={styles.section} aria-labelledby="delivery-heading">
      <div className={styles.inner}>
        <motion.div
          className={styles.headingBlock}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          custom={0}
        >
          <span className={styles.eyebrow}>
            <Zap size={13} strokeWidth={2.5} />
            Delivery
          </span>
          <h2 id="delivery-heading">Fast, Reliable UK &amp; Ireland Delivery</h2>
          <motion.div className={styles.headingLine} variants={lineGrow} style={{ originX: 0.5 }} />
          <p>{message}</p>
        </motion.div>

        <div className={styles.grid}>
          {list.map((card, i) => (
            <motion.article
              key={card.id}
              className={styles.card}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
              custom={i + 1}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <div className={styles.cardIcon}>
                <Truck size={22} strokeWidth={1.8} />
              </div>

              <div className={styles.cardBody}>
                <h3>{card.title}</h3>
                {card.message && <p className={styles.cardNote}>{card.message}</p>}

                <div className={styles.pills}>
                  <span className={styles.pill}>
                    Free over <strong>£{Number(card.freeThreshold).toFixed(0)}</strong>
                  </span>
                  <span className={`${styles.pill} ${styles.pillFrozen}`}>
                    <Snowflake size={11} strokeWidth={2} />
                    Frozen +<strong>£{Number(card.frozenFee).toFixed(2)}</strong>
                  </span>
                </div>
              </div>

              <div className={styles.cardGlow} aria-hidden />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
