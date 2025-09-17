'use client';

import styles from './Privacy.module.scss';

export default function PrivacyClient() {
  return (
    <article className={styles.content}>
      <header className={styles.head}>
        <h1 className={styles.title}>Privacy Policy</h1>
        <p className={styles.sub}>
          This Privacy Policy explains how we handle your personal data when you visit our website.
        </p>
      </header>

      <section className={styles.section}>
        <h2>Information We Collect</h2>
        <p>
          We collect basic contact information (name, email) and usage data through cookies and
          analytics.
        </p>
      </section>

      <section className={styles.section}>
        <h2>How We Use Your Information</h2>
        <ul>
          <li>To respond to inquiries and provide support</li>
          <li>To improve our services and website experience</li>
          <li>To comply with legal obligations</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>GDPR Rights</h2>
        <p>If you&apos;re located in the UK or EU, you have rights under GDPR:</p>
        <ul>
          <li>Access your data</li>
          <li>Request corrections</li>
          <li>Request deletion</li>
          <li>Object to processing</li>
        </ul>
      </section>

      <section className={styles.section}>
        <p>
          To exercise your rights, contact us at{' '}
          <a href="mailto:privacy@yourdomain.com" className={styles.link}>
            privacy@yourdomain.com
          </a>
          .
        </p>
      </section>

      <section className={styles.section}>
        <h2>Cookie Usage</h2>
        <p>
          We use cookies to enhance your experience. Learn more on our{' '}
          <a href="/cookies" className={styles.link}>
            Cookie Policy
          </a>{' '}
          page.
        </p>
      </section>
    </article>
  );
}
