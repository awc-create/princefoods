'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from './AccountMenu.module.scss';

const items = [
  { href: '/account?tab=overview', label: 'Overview' },
  { href: '/account?tab=profile', label: 'Profile' },
  { href: '/account?tab=orders', label: 'Orders' },
  { href: '/account?tab=addresses', label: 'Addresses' },
  { href: '/account?tab=security', label: 'Security' }
] as const;

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

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Small delay so you can move into the panel
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
        if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      {/* Trigger: link + caret button */}
      <div className={styles.triggerWrap}>
        <Link
          href="/account"
          className={styles.triggerLink}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className={styles.avatar} aria-hidden>
            {initial}
          </span>
          <span className={styles.label}>Account</span>
        </Link>
        <button
          type="button"
          className={styles.caretBtn}
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((s) => !s)}
        >
          ▾
        </button>
      </div>

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
              role="menuitem"
              onClick={() => signOut({ callbackUrl: '/' })}
            >
              Sign out
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
