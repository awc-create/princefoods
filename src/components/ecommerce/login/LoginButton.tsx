'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FaUser } from 'react-icons/fa';
import styles from './LoginButton.module.scss';

export default function LoginButton() {
  const { data: session, status } = useSession();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();

  // keep current query params
  const currentQs = Object.fromEntries(sp ?? []);
  const currentFull = (() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  // open login lightbox; keep existing params and add modal+callbackUrl
  const loginHref = {
    pathname,
    query: {
      ...currentQs,
      modal: 'login',
      callbackUrl: currentFull
    }
  } as const;

  // while loading, show neutral icon (prevents layout shift)
  if (status === 'loading') {
    return (
      <span className={`${styles.loginButton} ${styles.loading}`} aria-label="Loading session">
        <FaUser />
      </span>
    );
  }

  // authenticated -> go to account
  if (status === 'authenticated') {
    // show name/initial if you want
    const name = session?.user?.name?.trim();
    const initial = name?.[0]?.toUpperCase();

    return (
      <Link
        href="/account"
        className={`${styles.loginButton} ${styles.account}`}
        aria-label="Account"
        title={name ?? 'Account'}
      >
        <span className={styles.avatar} aria-hidden>
          {initial ?? <FaUser />}
        </span>
        <span className={styles.label}>Account</span>
      </Link>
    );
  }

  // unauthenticated -> open login modal
  return (
    <Link href={loginHref} className={styles.loginButton} aria-label="Sign in" title="Sign in">
      <FaUser />
    </Link>
  );
}
