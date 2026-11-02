'use client';

/**
 * Shop dropdown — parent categories with their children.
 *
 * Behaviour, in order of importance:
 *  - "Shop" stays a real link to /shop. The panel is an extra, never a trap:
 *    clicking the word always takes you to the full shop.
 *  - Hover opens it on pointer devices; keyboard and touch use the caret button.
 *  - Categories come from /api/categories/menu, which only returns ones holding
 *    sellable stock, so no link ever lands on an empty page.
 *  - If the fetch fails, the panel simply never opens and "Shop" behaves as a
 *    plain link. The nav must not break because a dropdown couldn't load.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ShopMenu.module.scss';

interface MenuChild {
  id: string;
  name: string;
  slug: string;
  count: number;
}
interface MenuParent extends MenuChild {
  children: MenuChild[];
}

const CLOSE_DELAY_MS = 140; // tolerance for crossing the gap to the panel

export default function ShopMenu({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const [cats, setCats] = useState<MenuParent[] | null>(null);
  const [open, setOpen] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  // Load once, lazily — the nav renders instantly either way.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/categories/menu');
        const j = (await res.json()) as { ok?: boolean; categories?: MenuParent[] };
        if (!cancelled && res.ok && j.ok) setCats(j.categories ?? []);
      } catch {
        /* leave null — menu stays a plain link */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  // Close on Escape, and on click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // Navigating always dismisses it.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => cancelClose, [cancelClose]);

  const hasMenu = (cats?.length ?? 0) > 0;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={hasMenu ? () => { cancelClose(); setOpen(true); } : undefined}
      onMouseLeave={hasMenu ? scheduleClose : undefined}
    >
      <div className={styles.trigger}>
        <Link href={href} className={pathname === href ? styles.active : undefined}>
          {label}
        </Link>

        {hasMenu && (
          <button
            type="button"
            className={styles.caret}
            aria-expanded={open}
            aria-haspopup="true"
            aria-label={open ? 'Hide categories' : 'Show categories'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`${styles.caretIcon} ${open ? styles.caretOpen : ''}`} aria-hidden>
              ⌄
            </span>
          </button>
        )}
      </div>

      {hasMenu && (
        <div
          className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
          role="menu"
          aria-label="Shop categories"
          // `inert`-like: fully removed from the tab order while closed
          aria-hidden={!open}
        >
          <div className={styles.columns}>
            {cats!.map((parent) => (
              <div key={parent.id} className={styles.column} role="none">
                <Link
                  href={`/shop?collection=${encodeURIComponent(parent.slug)}`}
                  className={styles.parent}
                  role="menuitem"
                  tabIndex={open ? 0 : -1}
                >
                  {parent.name}
                  <span className={styles.count}>{parent.count}</span>
                </Link>

                {parent.children.length > 0 && (
                  <ul className={styles.childList}>
                    {parent.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={`/shop?collection=${encodeURIComponent(child.slug)}`}
                          className={styles.child}
                          role="menuitem"
                          tabIndex={open ? 0 : -1}
                        >
                          {child.name}
                          <span className={styles.count}>{child.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <Link
            href={href}
            className={styles.viewAll}
            role="menuitem"
            tabIndex={open ? 0 : -1}
          >
            View everything →
          </Link>
        </div>
      )}
    </div>
  );
}
