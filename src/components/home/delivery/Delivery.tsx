'use client';

import { FaTruck } from 'react-icons/fa';
import styles from './Delivery.module.scss';

export default function Delivery({
  gbFreeThreshold = 30,
  niFreeThreshold = 40,
  frozenFee = 3.99,
  message = 'No hidden fees. Frozen items are insulated for freshness.'
}: {
  gbFreeThreshold?: number;
  niFreeThreshold?: number;
  frozenFee?: number;
  message?: string;
}) {
  return (
    <section className={styles.deliveryWrapper} aria-labelledby="delivery-heading">
      <div className={styles.container}>
        <div className={styles.headingBlock}>
          <h2 id="delivery-heading">Fast, Reliable UK &amp; Ireland Delivery</h2>
          <p>{message}</p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <FaTruck size={40} />
            <div>
              <h3>Delivery – Great Britain</h3>
              <ul>
                <li>
                  Free delivery on orders above <strong>£{gbFreeThreshold}</strong>
                </li>
                <li>
                  Frozen packing fee <strong>£{frozenFee.toFixed(2)}</strong>
                </li>
              </ul>
            </div>
          </div>

          <div className={styles.card}>
            <FaTruck size={40} />
            <div>
              <h3>Delivery – Northern Ireland</h3>
              <ul>
                <li>
                  Free delivery on orders above <strong>£{niFreeThreshold}</strong>
                </li>
                <li>
                  Frozen packing fee <strong>£{frozenFee.toFixed(2)}</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
