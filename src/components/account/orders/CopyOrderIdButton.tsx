'use client';

import { useState } from 'react';
import styles from './CopyOrderIdButton.module.scss';

export default function CopyOrderIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  return (
    <button type="button" className={styles.btn} onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy order #'}
    </button>
  );
}
