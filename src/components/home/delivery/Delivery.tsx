'use client';

import { FaTruck } from 'react-icons/fa';
import styles from './Delivery.module.scss';

export default function Delivery() {
  return (
    <section className={styles.deliveryWrapper} aria-labelledby="delivery-heading">
      <div className={styles.container}>
        <div className={styles.headingBlock}>
          <h2 id="delivery-heading">Fast, Reliable UK &amp; Ireland Delivery</h2>
          <p>No hidden fees. Frozen items are insulated for freshness.</p>
        </div>

        <div className={styles.grid}>
          <div className={styles.card}>
            <FaTruck size={40} />
            <div>
              <h3>Delivery – Great Britain</h3>
              <ul>
                <li>
                  Free delivery on orders above <strong>£30</strong>
                </li>
                <li>
                  Frozen packing fee <strong>£3.99</strong>
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
                  Free delivery on orders above <strong>£40</strong>
                </li>
                <li>
                  Frozen packing fee <strong>£3.99</strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
