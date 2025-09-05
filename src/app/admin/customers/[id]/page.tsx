'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './Detail.module.scss';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'HEAD' | 'STAFF' | 'VIEWER';
  source: 'LOCAL' | 'WIX';
  welcomeStatus: 'PENDING' | 'SENT' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

interface Stat {
  conversations: number;
  lastInteraction?: string | null;
}

interface Thread {
  id: string;
  status: string;
  lastMessagePreview: string;
  createdAt: string;
  lastUserAt?: string;
  lastAdminAt?: string;
}

interface OrderRow {
  id: string;
  number: string;
  date: string;
  items: string;
  total: string;
  status: string;
}

export default function CustomerDetailPage() {
  // ✅ Non-null assertion so TS knows params will exist
  const params = useParams<{ id: string }>()!;
  const id = params.id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [stats, setStats] = useState<Stat | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersNote, setOrdersNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const [cRes, oRes] = await Promise.all([
        fetch(`/api/customers/${id}`),
        fetch(`/api/customers/${id}/orders`)
      ]);
      const c = await cRes.json();
      const o = await oRes.json();
      if (ignore) return;

      setContact(c.contact);
      setStats(c.stats);
      setThreads(c.recentThreads ?? []);
      setOrders(o.items ?? []);
      setOrdersNote(o.note ?? null);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  if (loading)
    return (
      <div className={styles.wrapper}>
        <p>Loading…</p>
      </div>
    );
  if (!contact)
    return (
      <div className={styles.wrapper}>
        <p>Not found.</p>
      </div>
    );

  return (
    <div className={styles.wrapper}>
      <Link href="/admin/customers" className={styles.back}>
        &larr; Customers
      </Link>

      <header className={styles.header}>
        <div className={styles.avatar}>{contact.name?.[0] || 'C'}</div>
        <div className={styles.identity}>
          <h1>{contact.name}</h1>
          <div className={styles.meta}>
            <span>{contact.email}</span>
            {contact.phone && <span>· {contact.phone}</span>}
            <span>· role: {contact.role}</span>
            <span>· welcome: {contact.welcomeStatus}</span>
          </div>
        </div>
      </header>

      <section className={styles.grid}>
        <div className={styles.card}>
          <h3>Engagement</h3>
          <ul className={styles.kpis}>
            <li>
              <strong>Conversations</strong>
              <span>{stats?.conversations ?? 0}</span>
            </li>
            <li>
              <strong>Last interaction</strong>
              <span>{stats?.lastInteraction ?? '—'}</span>
            </li>
            <li>
              <strong>Joined</strong>
              <span>{new Date(contact.createdAt).toLocaleDateString()}</span>
            </li>
          </ul>
        </div>

        <div className={styles.card}>
          <h3>Recent messages</h3>
          {threads.length === 0 ? (
            <p className={styles.muted}>No conversations yet.</p>
          ) : (
            <ul className={styles.threadList}>
              {threads.map((t) => (
                <li key={t.id}>
                  <div className={styles.threadTop}>
                    <span className={styles.badge}>{t.status}</span>
                    <span className={styles.threadDates}>
                      {t.lastUserAt
                        ? new Date(t.lastUserAt).toLocaleString()
                        : new Date(t.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p>{t.lastMessagePreview}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={styles.card}>
          <h3>Orders</h3>
          {ordersNote && <p className={styles.muted}>{ordersNote}</p>}
          {orders.length === 0 ? (
            !ordersNote && <p className={styles.muted}>No orders.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.number}</td>
                      <td>{o.date}</td>
                      <td>{o.items}</td>
                      <td>{o.total}</td>
                      <td>{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
