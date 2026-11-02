'use client';

/**
 * Shop dropdown — two-pane: parent categories on the left, the hovered
 * parent's children on the right.
 *
 * The first attempt laid every parent out as a grid column, which meant a
 * 2-child category sat beside a 14-child one: enormous dead space and a panel
 * taller than the viewport. A two-pane layout keeps a fixed, compact footprint
 * no matter how lopsided the tree is.
 *
 * Behaviour:
 *  - "Shop" stays a real link to /shop; only the caret toggles the panel.
 *  - Hovering a parent swaps the right pane; clicking it opens that category.
 *  - Categories come from /api/categories/menu, which only returns ones with
 *    sellable stock, so no link lands on an empty page.
 *  - If the fetch fails the panel never opens and "Shop" is a plain link.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const CLOSE_DELAY_MS = 140;

export default function ShopMenu({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const [cats, setCats] = useState<MenuParent[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/categories/menu');
        const j = (await res.json()) as { ok?: boolean; categories?: MenuParent[] };
        if (cancelled || !res.ok || !j.ok) return;
        const list = j.categories ?? [];
        setCats(list);
        setActiveId(list[0]?.id ?? null);
      } catch {
        /* stays a plain link */
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
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

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => cancelClose, [cancelClose]);

  const hasMenu = cats.length > 0;
  const active = useMemo(
    () => cats.find((c) => c.id === activeId) ?? cats[0] ?? null,
    [cats, activeId]
  );

  const catHref = (slug: string) => `/shop?collection=${encodeURIComponent(slug)}`;

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
          aria-hidden={!open}
        >
          <div className={styles.body}>
            {/* Left: parents */}
            <ul className={styles.rail}>
              {cats.map((parent) => (
                <li key={parent.id}>
                  <Link
                    href={catHref(parent.slug)}
                    role="menuitem"
                    tabIndex={open ? 0 : -1}
                    className={`${styles.railItem} ${
                      active?.id === parent.id ? styles.railItemActive : ''
                    }`}
                    onMouseEnter={() => setActiveId(parent.id)}
                    onFocus={() => setActiveId(parent.id)}
                  >
                    <span className={styles.railName}>{parent.name}</span>
                    <span className={styles.count}>{parent.count}</span>
                  </Link>
                </li>
              ))}
            </ul>

            {/* Right: children of the highlighted parent */}
            <div className={styles.pane}>
              {active && (
                <>
                  <div className={styles.paneHead}>
                    <Link
                      href={catHref(active.slug)}
                      className={styles.paneTitle}
                      role="menuitem"
                      tabIndex={open ? 0 : -1}
                    >
                      All {active.name}
                      <span className={styles.paneArrow} aria-hidden>
                        →
                      </span>
                    </Link>
                  </div>

                  {active.children.length > 0 ? (
                    <ul className={styles.childGrid}>
                      {active.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={catHref(child.slug)}
                            className={styles.child}
                            role="menuitem"
                            tabIndex={open ? 0 : -1}
                          >
                            <span className={styles.childName}>{child.name}</span>
                            <span className={styles.count}>{child.count}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.noChildren}>
                      {active.count} item{active.count === 1 ? '' : 's'} in this category.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          <Link href={href} className={styles.viewAll} role="menuitem" tabIndex={open ? 0 : -1}>
            View everything →
          </Link>
        </div>
      )}
    </div>
  );
}
