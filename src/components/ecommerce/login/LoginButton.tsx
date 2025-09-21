// src/components/ecommerce/login/LoginButton.tsx
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FaUser } from 'react-icons/fa';
import styles from './LoginButton.module.scss';

export default function LoginButton() {
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();

  const currentQs = Object.fromEntries(sp ?? []);
  const currentFull = (() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  const query: Record<string, string> = { ...currentQs, modal: 'login' };

  // Only add callbackUrl if it’s missing OR different from current
  const existing = currentQs['callbackUrl'];
  const decoded = existing ? decodeURIComponent(existing) : null;
  const same =
    decoded === currentFull ||
    decoded === pathname ||
    decoded === '/' ||
    decoded?.replace(/\?.*$/, '') === pathname;

  if (!existing || same === false) {
    query.callbackUrl = currentFull;
  }

  const href = { pathname, query } as const;

  return (
    <Link href={href} className={styles.loginButton} aria-label="Sign in" title="Sign in">
      <FaUser />
    </Link>
  );
}
