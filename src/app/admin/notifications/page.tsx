// src/app/admin/notifications/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import styles from '../Admin.module.scss';

interface Row {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const fetching = useRef(false);

  const fetchRows = async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await fetch('/api/admin/notifications?limit=50', { cache: 'no-store' });
      const json = await res.json();
      if (json?.ok) setRows(json.data as Row[]);
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRows();

    // 🔔 Live refresh when editors broadcast
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('admin_notifications');
      bc.onmessage = (evt) => {
        if (!evt?.data) return;
        if (evt.data.type === 'notification:new') {
          void fetchRows();
        }
      };
    } catch {
      // ignore
    }

    // Fallback: same-tab DOM event
    const onDomPing = () => void fetchRows();
    window.addEventListener('admin:notif:new', onDomPing);

    // Safety net: light polling (in case user has another window, etc.)
    const poll = setInterval(fetchRows, 10000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('admin:notif:new', onDomPing);
      clearInterval(poll);
    };
  }, []);

  return (
    <div>
      <h1>Notifications</h1>
      {loading ? (
        <div>Loading…</div>
      ) : rows.length === 0 ? (
        <div className={styles.bellEmpty} style={{ textAlign: 'left' }}>
          No notifications yet.
        </div>
      ) : (
        <ul className={styles.notifList}>
          {rows.map((n) => (
            <li key={n.id} className={`${styles.notifRow} ${n.readAt ? styles.notifRead : ''}`}>
              <Link href={`/admin/notifications/${n.id}`} className={styles.notifRowLink}>
                <div className={styles.notifRowTitle}>{n.title}</div>
                <div className={styles.notifRowBody}>{n.body}</div>
                <time className={styles.notifRowTime}>
                  {new Date(n.createdAt).toLocaleString()}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
