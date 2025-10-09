// src/components/admin/NotificationBell.tsx
'use client';

import styles from '@/app/admin/Admin.module.scss';
import { useEffect, useState } from 'react';

interface Notification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  link?: string | null;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) setItems(json.data); // API returns { ok, data }
    };
    void load();
  }, []);

  const unreadCount = items.filter((n) => !n.readAt).length;

  return (
    <div className={styles.bellWrapper}>
      <button
        type="button"
        className={`${styles.bellBtn} ${open ? styles.bellBtnActive : ''}`}
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && <span className={styles.bellBadge}>{unreadCount}</span>}
      </button>

      {open && (
        <div className={styles.bellMenu}>
          <div className={styles.bellMenuHeader}>Notifications</div>
          {items.length === 0 && <div className={styles.bellEmpty}>No notifications yet.</div>}
          {items.map((n) => (
            <a
              key={n.id}
              href={n.link ?? '#'}
              className={`${styles.bellItem} ${n.readAt ? styles.bellRead : ''}`}
            >
              <div className={styles.bellItemTitle}>{n.title}</div>
              <div className={styles.bellItemBody}>{n.body}</div>
              <time className={styles.bellTime}>
                {new Date(n.createdAt).toLocaleString('en-GB', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: 'short'
                })}
              </time>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
