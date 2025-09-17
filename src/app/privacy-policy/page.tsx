import { Suspense } from 'react';
import styles from './Privacy.module.scss';
import PrivacyClient from './PrivacyClient';

export const metadata = {
  title: 'Privacy Policy',
  description: 'Learn how we collect, use, and protect your personal data.'
};

// Keep this page purely server-side; Navbar/other hooks are already Suspense-wrapped elsewhere.
export default function PrivacyPolicyPage() {
  return (
    <div className={styles.wrapper}>
      <Suspense fallback={<p className={styles.loading}>Loading privacy policy…</p>}>
        <PrivacyClient />
      </Suspense>
    </div>
  );
}
