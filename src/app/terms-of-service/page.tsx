import { Suspense } from 'react';
import TermsClient from './TermsClient';

import styles from './Terms.module.scss';

export const metadata = {
  title: 'Terms of Service',
  description: 'Understand the terms and conditions for using our website.'
};

export default function TermsPage() {
  return (
    <div className={styles.wrapper}>
      <Suspense fallback={<p>Loading terms…</p>}>
        <TermsClient />
      </Suspense>
    </div>
  );
}
