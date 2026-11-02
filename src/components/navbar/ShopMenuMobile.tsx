'use client';

/**
 * Mobile version of the Shop categories menu — an accordion inside the existing
 * mobile nav, rather than a second navigation pattern.
 *
 * Hover menus don't exist on touch, so the desktop panel is useless on a phone.
 * Same data source, same "only sellable categories" rule.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from './ShopMenuMobile.module.scss';

interface MenuChild {
  id: string;
  name: string;
  slug: string;
  count: number;
}
interface MenuParent extends MenuChild {
  children: MenuChild[];
}

export default function ShopMenuMobile({
  href,
  label,
  onNavigate
}: {
  href: string;
  label: string;
  onNavigate: () => void;
}) {
  const [cats, setCats] = useState<MenuParent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/categories/menu');
        const j = (await res.json()) as { ok?: boolean; categories?: MenuParent[] };
        if (!cancelled && res.ok && j.ok) setCats(j.categories ?? []);
      } catch {
        /* no categories — the Shop link below still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        {/* Tapping the label goes to the shop; only the chevron expands. */}
        <Link href={href} onClick={onNavigate} className={styles.shopLink}>
          {label}
        </Link>

        {cats.length > 0 && (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-label={open ? 'Hide categories' : 'Show categories'}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`${styles.chev} ${open ? styles.chevOpen : ''}`} aria-hidden>
              ⌄
            </span>
          </button>
        )}
      </div>

      {open && cats.length > 0 && (
        <div className={styles.list}>
          {cats.map((parent) => (
            <div key={parent.id} className={styles.group}>
              <Link
                href={`/shop?collection=${encodeURIComponent(parent.slug)}`}
                onClick={onNavigate}
                className={styles.parent}
              >
                {parent.name}
                <span className={styles.count}>{parent.count}</span>
              </Link>

              {parent.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/shop?collection=${encodeURIComponent(child.slug)}`}
                  onClick={onNavigate}
                  className={styles.child}
                >
                  {child.name}
                  <span className={styles.count}>{child.count}</span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
