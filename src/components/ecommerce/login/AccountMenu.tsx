'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './AccountMenu.module.scss';

interface MenuItem {
  href: string;
  label: string;
}

const items: MenuItem[] = [
  { href: '/account?tab=overview', label: 'Overview' },
  { href: '/account?tab=orders', label: 'Orders' },
  { href: '/account?tab=addresses', label: 'Addresses' },
  { href: '/account?tab=wallet', label: 'Wallet' },
  { href: '/account?tab=security', label: 'Security' }
];

export default function AccountMenu({
  name,
  email
}: {
  name?: string | null;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);

  // Close when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Hover helpers with a tiny delay so you can move the cursor
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const initial = (name ?? email ?? 'A').slice(0, 1).toUpperCase();

  return (
    <div
      ref={rootRef}
      className={`${styles.container} ${open ? styles.open : ''}`}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => setOpen(true)}
      onBlur={(e) => {
        // Close only if focus moved fully outside
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {/* Trigger */}
      <button
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
      >
        <span className={styles.avatar} aria-hidden>
          {initial}
        </span>
        <span className={styles.label}>Account</span>
      </button>

      {/* Menu */}
      <div role="menu" className={styles.menu}>
        <ul className={styles.list}>
          {items.map((it) => (
            <li key={it.href} role="none">
              <Link
                role="menuitem"
                href={it.href}
                className={styles.item}
                onClick={() => setOpen(false)}
              >
                {it.label}
              </Link>
            </li>
          ))}

          <li className={styles.sep} role="separator" />

          <li role="none">
            <button
              className={`${styles.item} ${styles.signOut}`}
              onClick={() => signOut({ callbackUrl: '/' })}
              role="menuitem"
            >
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
