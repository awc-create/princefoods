'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Cookies.module.scss';

type Pref = 'essential' | 'all' | 'custom';

export default function CookiesClient() {
  const sp = useSearchParams(); // may be null in some typings

  const [pref, setPref] = useState<Pref>('essential');

  // Load initial value from URL (?pref) or localStorage (URL wins)
  useEffect(() => {
    const urlPref = (sp?.get('pref') as Pref | null) ?? null;
    const storedPref =
      typeof window !== 'undefined'
        ? ((localStorage.getItem('cookie:pref') as Pref | null) ?? null)
        : null;

    setPref(urlPref ?? storedPref ?? 'essential');
  }, [sp]);

  // Persist to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('cookie:pref', pref);
    } catch {
      // ignore storage errors (private mode, etc.)
    }
  }, [pref]);

  return (
    <div className={styles.clientBox}>
      <h2>Manage your preferences</h2>
      <p className={styles.muted}>
        Select which cookies you want to allow. Your choice is saved in your browser.
      </p>

      <div className={styles.options}>
        <label>
          <input
            type="radio"
            name="cookiePref"
            checked={pref === 'essential'}
            onChange={() => setPref('essential')}
          />
          <span>Essential only</span>
        </label>

        <label>
          <input
            type="radio"
            name="cookiePref"
            checked={pref === 'all'}
            onChange={() => setPref('all')}
          />
          <span>Allow all</span>
        </label>

        <label>
          <input
            type="radio"
            name="cookiePref"
            checked={pref === 'custom'}
            onChange={() => setPref('custom')}
          />
          <span>Custom</span>
        </label>
      </div>

      <p className={styles.note}>Current preference: {pref}</p>
    </div>
  );
}
