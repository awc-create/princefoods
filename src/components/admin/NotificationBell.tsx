// src/components/admin/NotificationBell.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './NotificationBell.module.scss';

interface Notification {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState<number>(0);

  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ display: 'none' });

  async function load(limit = 10) {
    try {
      const res = await fetch(`/api/admin/notifications?limit=${limit}`, { cache: 'no-store' });
      const json = (await res.json()) as { ok: boolean; data: Notification[] };
      if (json?.ok && Array.isArray(json.data)) {
        setItems(json.data);
        setUnread(json.data.filter((n) => !n.readAt).length);
      }
    } catch {
      /* ignore */
    }
  }

  // Initial + polling (10s) so you don’t need to refresh
  useEffect(() => {
    load();
    const t = setInterval(() => load(), 10_000);
    return () => clearInterval(t);
  }, []);

  // Keep the menu positioned
  useEffect(() => {
    if (!open) return;

    const position = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return setMenuStyle({ display: 'none' });
      const GAP = 10;
      const width = 340;
      const left = Math.max(12, r.right - width);
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + GAP,
        left,
        width,
        maxHeight: '72vh',
        zIndex: 9999
      });
    };

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [open]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const btn = btnRef.current;
      if (!btn) return;
      const target = e.target as Node;
      if (!btn.contains(target) && !(target as HTMLElement).closest?.(`.${styles.bellMenu}`)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const markAllRead = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch('/api/admin/notifications/mark-all-read', { method: 'POST' });
      setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  };

  const onOpenAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.location.assign('/admin/notifications');
  };

  const onRowClick = (n: Notification) => async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await fetch(`/api/admin/notifications/${n.id}`, { method: 'PATCH' }); // mark read
      setItems((xs) =>
        xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      setUnread((u) => Math.max(0, u - (n.readAt ? 0 : 1)));
    } finally {
      // Navigate after marking read
      const href = n.link ?? `/admin/notifications/${n.id}`;
      window.location.assign(href);
    }
  };

  return (
    <div className={styles.bellWrapper}>
      <button
        ref={btnRef}
        type="button"
        className={`${styles.bellBtn} ${open ? styles.bellBtnActive : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title="Notifications"
      >
        🔔
        {unread > 0 && <span className={styles.bellBadge}>{unread}</span>}
      </button>

      {open &&
        createPortal(
          <div className={styles.bellMenu} style={menuStyle} role="menu" aria-label="Notifications">
            <div className={styles.bellHeader}>
              <div className={styles.bellHeaderLeft}>
                <span className={styles.bellTitle}>Notifications</span>
                {unread > 0 && <span className={styles.bellUnreadPill}>{unread}</span>}
              </div>

              {items.length > 0 && (
                <button type="button" onClick={markAllRead} className={styles.bellLinkBtn}>
                  Mark all read
                </button>
              )}
              <button type="button" onClick={onOpenAll} className={styles.bellLinkBtn}>
                View all
              </button>
            </div>

            {items.length === 0 ? (
              <div className={styles.bellEmpty}>
                <div className={styles.bellEmoji}>🔕</div>
                <div>No notifications yet.</div>
              </div>
            ) : (
              <ul className={styles.bellList}>
                {items.map((n) => {
                  const isRead = !!n.readAt;
                  const when = new Date(n.createdAt).toLocaleString();
                  return (
                    <li key={n.id}>
                      <a
                        href={n.link ?? `/admin/notifications/${n.id}`}
                        className={`${styles.bellItem} ${isRead ? styles.bellRead : ''}`}
                        onClick={onRowClick(n)}
                      >
                        {!isRead && <span className={styles.bellDot} aria-hidden />}
                        <div className={styles.bellText}>
                          <div className={styles.bellItemTitle}>{n.title}</div>
                          {n.body && <div className={styles.bellItemBody}>{n.body}</div>}
                        </div>
                        <time className={styles.bellTime} title={when}>
                          {when}
                        </time>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className={styles.bellFooter}>
              <button type="button" onClick={onOpenAll} className={styles.bellLinkBtn}>
                Open notifications
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
