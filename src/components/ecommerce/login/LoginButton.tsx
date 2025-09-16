'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FaUser } from 'react-icons/fa';
import styles from './LoginButton.module.scss';

export default function LoginButton() {
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();

  // keep current query params
  const currentQs = Object.fromEntries(sp ?? []);
  const currentFull = (() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();

  // open the login lightbox; keep existing params and add modal+callbackUrl
  const href = {
    pathname,
    query: {
      ...currentQs,
      modal: 'login',
      callbackUrl: currentFull
    }
  } as const;

  return (
    <Link href={href} className={styles.loginButton} aria-label="Sign in" title="Sign in">
      <FaUser />
    </Link>
  );
}
