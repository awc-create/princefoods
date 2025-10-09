'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Noti {
  id: string;
  createdAt: string;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
}

export default function RecentNotifications() {
  const [items, setItems] = useState<Noti[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/admin/notifications?take=5', { cache: 'no-store' });
        const j = await r.json();
        if (j.ok) setItems(j.data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h2 style={{ margin: '0 0 .5rem' }}>Recent notifications</h2>
      {loading && <div>Loading…</div>}
      {!loading && items.length === 0 && <div style={{ color: '#666' }}>No notifications yet.</div>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((n) => (
          <li key={n.id} style={{ padding: '.5rem 0', borderBottom: '1px solid #eee' }}>
            <Link href={n.link ?? '#'} style={{ textDecoration: 'none' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>{n.title}</div>
              <div style={{ fontSize: '.85rem', color: '#555' }}>{n.body}</div>
              <div style={{ fontSize: '.75rem', color: '#999' }}>
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '.5rem' }}>
        <Link href="/admin" onClick={(e) => e.preventDefault()} style={{ fontSize: '.85rem' }}>
          View all in bell menu ↑
        </Link>
      </div>
    </section>
  );
}
