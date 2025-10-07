'use client';

import { FaTruck } from 'react-icons/fa';
import styles from './Delivery.module.scss';

export interface DeliveryCard {
  id: string;
  title: string; // e.g. "Delivery – Great Britain"
  freeThreshold: number; // e.g. 30
  frozenFee: number; // e.g. 3.99
  message?: string; // optional per-card note/line under title
}

export default function Delivery({
  // NEW: preferred, dynamic cards
  cards,

  // LEGACY: keep current props as fallback (matches your existing behavior)
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
  // Build the display list:
  // - If cards provided & non-empty, use them.
  // - Else, fall back to the two legacy cards (GB + NI) you previously rendered.
  const list: DeliveryCard[] =
    cards && cards.length > 0
      ? cards
      : [
          {
            id: 'gb',
            title: 'Delivery – Great Britain',
            freeThreshold: gbFreeThreshold,
            frozenFee
          },
          {
            id: 'ni',
            title: 'Delivery – Northern Ireland',
            freeThreshold: niFreeThreshold,
            frozenFee
          }
        ];

  return (
    <section className={styles.deliveryWrapper} aria-labelledby="delivery-heading">
      <div className={styles.container}>
        <div className={styles.headingBlock}>
          <h2 id="delivery-heading">Fast, Reliable UK &amp; Ireland Delivery</h2>
          <p>{message}</p>
        </div>

        <div className={styles.grid} role="list">
          {list.map((card) => (
            <article key={card.id} className={styles.card} role="listitem">
              <FaTruck size={40} />
              <div>
                <h3>{card.title}</h3>
                {card.message && <p className={styles.cardNote}>{card.message}</p>}
                <ul>
                  <li>
                    Free delivery on orders above{' '}
                    <strong>£{Number(card.freeThreshold).toFixed(0)}</strong>
                  </li>
                  <li>
                    Frozen packing fee <strong>£{Number(card.frozenFee).toFixed(2)}</strong>
                  </li>
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
