'use client';
import React from 'react';

import styles from './Delivery.module.scss';
import { FaTruck } from 'react-icons/fa';

export default function Delivery() {
  return (
    <section className={styles.deliveryWrapper}>
      <div className={styles.container}>
        <div className={styles.block}>
          <FaTruck size={60} />
          <h3>Delivery - Great Britain</h3>
          <p>📦 Free Delivery – Orders above £30</p>
          <p>❄️ £3.99 packing fee for frozen items</p>
        </div>
        <div className={styles.block}>
          <FaTruck size={60} />
          <h3>Delivery - Northern Ireland</h3>
          <p>📦 Free Delivery – Orders above £40</p>
          <p>❄️ £3.99 packing fee for frozen items</p>
        </div>
      </div>
    </section>
  );
}
