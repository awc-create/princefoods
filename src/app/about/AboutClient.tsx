'use client';
import React from 'react';
import styles from './About.module.scss';

export default function AboutClient() {
  return (
    <section className={styles.hero}>
      <div className={styles.overlay}>
        <div className={styles.content}>
          <h1>Your Favourite South Asian Grocery—A Reminder of Home</h1>
          <p className={styles.subtitle}>Quality, value & nostalgia in every bite</p>
          <p className={styles.description}>
            Since 2007, Prince Foods has connected the South Asian community in England, Scotland,
            Wales and Ireland with authentic staples—from premium spices and pulses to snacks and
            frozen delicacies—at unbeatable everyday prices. Our curated collections, intuitive
            online store and reliable UK- & Ireland-wide delivery make it easy to stock your pantry
            with the flavours you love.
          </p>
        </div>
      </div>
    </section>
  );
}
