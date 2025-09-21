// src/components/ecommerce/login/AccountMenu.tsx
'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useMemo } from 'react';
import styles from './AccountMenu.module.scss';

export default function AccountMenu() {
  const { data, status } = useSession();

  // Compute avatar initial regardless; if no user, fall back to '?'
  const initial = useMemo(() => {
    const s = (data?.user?.name ?? data?.user?.email ?? '?').trim();
    return s.slice(0, 1).toUpperCase();
  }, [data?.user?.name, data?.user?.email]);

  const isAuthed = status === 'authenticated' && !!data?.user;

  return (
    <div className={styles.wrap} aria-haspopup="true" aria-expanded={isAuthed ? true : false}>
      {isAuthed ? (
        <>
          <button className={styles.avatarBtn} aria-label="Account">
            <span className={styles.avatar}>{initial}</span>
            <span className={styles.label}>Account</span>
          </button>

          <div className={styles.menu} role="menu">
            <Link role="menuitem" href="/account?tab=overview" className={styles.item}>
              Overview
            </Link>
            <Link role="menuitem" href="/account?tab=orders" className={styles.item}>
              Orders
            </Link>
            <Link role="menuitem" href="/account?tab=addresses" className={styles.item}>
              Addresses
            </Link>
            <Link role="menuitem" href="/account?tab=wallet" className={styles.item}>
              Wallet
            </Link>
            <Link role="menuitem" href="/account?tab=security" className={styles.item}>
              Security
            </Link>
            <div className={styles.sep} />
            <button
              role="menuitem"
              className={`${styles.item} ${styles.danger}`}
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
