'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './Detail.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type Source = 'LOCAL' | 'WIX';
type WelcomeStatus = 'PENDING' | 'SENT' | 'COMPLETED';

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  source: Source;
  welcomeStatus: WelcomeStatus;
  createdAt: string;
  updatedAt: string;

  // new flags
  deletedAt?: string | null;
  restrictionNote?: string | null;
  deletionReason?: string | null;
  isAnonymized?: boolean;
  anonymizedAt?: string | null;
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
  lastUserAt?: string | null;
  lastAdminAt?: string | null;
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
  const params = useParams<{ id: string }>()!;
  const id = params.id;

  const [contact, setContact] = useState<Contact | null>(null);
  const [stats, setStats] = useState<Stat | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersNote, setOrdersNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const [cRes, oRes] = await Promise.all([
          fetch(`/api/customers/${id}`, { cache: 'no-store' }),
          fetch(`/api/customers/${id}/orders`, { cache: 'no-store' })
        ]);
        const c = await cRes.json();
        const o = await oRes.json();
        if (ignore) return;

        setContact((c.contact ?? null) as Contact | null);
        setStats(c.stats ?? null);
        setThreads(c.recentThreads ?? []);
        setOrders(o.items ?? []);
        setOrdersNote(o.note ?? null);
      } catch {
        if (!ignore) setErr('Failed to load customer.');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  const joinedDate = useMemo(
    () => (contact ? new Date(contact.createdAt).toLocaleDateString() : ''),
    [contact]
  );

  if (loading)
    return (
      <div className={styles.wrapper}>
        <p>Loading…</p>
      </div>
    );

  if (err || !contact)
    return (
      <div className={styles.wrapper}>
        <Link href="/admin/customers" className={styles.back}>
          &larr; Customers
        </Link>
        <p>{err ?? 'Not found.'}</p>
      </div>
    );

  // from here on, `contact` is non-null
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
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            {contact.phone && <span>· {contact.phone}</span>}
            <span>· role: {contact.role}</span>
            <span>· welcome: {contact.welcomeStatus}</span>
            <span>· source: {contact.source}</span>
          </div>
        </div>
      </header>

      {/* Restriction/Erasure status + actions */}
      <RestrictEraseCard contact={contact} />

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
              <span>{joinedDate}</span>
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

/** Child component with a non-null `contact` prop, avoiding "possibly null" */
function RestrictEraseCard({ contact }: { contact: Contact }) {
  async function post(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const t = await res.json().catch(() => ({}));
      throw new Error(t?.error ?? 'Action failed');
    }
    // naive reload after action
    window.location.reload();
  }

  return (
    <section className={styles.grid}>
      <div className={styles.card}>
        <h3>Restriction / Erasure</h3>

        <div className={styles.muted} style={{ marginBottom: '.5rem' }}>
          Prefer <strong>soft-delete (restrict)</strong> or <strong>anonymize</strong> when
          transactional history exists.
        </div>

        <div className={styles.flags}>
          {contact.deletedAt && (
            <span className={styles.badge}>
              Restricted since {new Date(contact.deletedAt).toLocaleDateString()}
            </span>
          )}
          {contact.isAnonymized && (
            <span className={styles.badge}>
              Anonymized
              {contact.anonymizedAt
                ? ` on ${new Date(contact.anonymizedAt).toLocaleDateString()}`
                : ''}
            </span>
          )}
          {contact.deletionReason && (
            <span className={styles.badge}>Reason: {contact.deletionReason}</span>
          )}
          {contact.restrictionNote && (
            <span className={styles.badge}>Note: {contact.restrictionNote}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '.5rem', marginTop: '.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() =>
              post(`/api/customers/${contact.id}/restrict`, { reason: 'Admin request' })
            }
          >
            Restrict (Soft-delete)
          </button>
          <button onClick={() => post(`/api/customers/${contact.id}/anonymize`)}>Anonymize</button>
          <button onClick={() => post(`/api/customers/${contact.id}/restore`)}>Restore</button>
        </div>
      </div>
    </section>
  );
}
