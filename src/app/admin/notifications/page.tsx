// src/app/admin/notifications/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Row {
  id: string;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  createdAt: string;
}

// Human-friendly labels and icons for each notification kind
const KIND_META: Record<string, { icon: string; label: string; color: string }> = {
  order_cancelled: { icon: '🚫', label: 'Order Cancelled', color: '#dc2626' },
  order_refund: { icon: '💸', label: 'Refund Issued', color: '#7c3aed' },
  order_refund_manual: { icon: '💸', label: 'Manual Refund', color: '#7c3aed' },
  order_cancel_failed: { icon: '⚠️', label: 'Cancel Failed', color: '#b45309' },
  order_email_changed: { icon: '✉️', label: 'Email Updated', color: '#0369a1' },
  shipment_created: { icon: '🚚', label: 'Shipment Created', color: '#059669' },
  label_ready: { icon: '🏷️', label: 'Label Ready', color: '#059669' },
  label_purchased: { icon: '🏷️', label: 'Label Purchased', color: '#059669' },
  label_failed: { icon: '❌', label: 'Label Failed', color: '#dc2626' },
  customer_anonymized: { icon: '🔒', label: 'Customer Anonymized', color: '#6b7280' },
  customer_restricted: { icon: '🔒', label: 'Customer Restricted', color: '#b45309' },
  customer_restored: { icon: '✅', label: 'Customer Restored', color: '#059669' },
  homeSettings: { icon: '🏠', label: 'Site Settings Changed', color: '#0369a1' }
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? { icon: '🔔', label: kind, color: '#6b7280' };
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
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
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel('admin_notifications');
      bc.onmessage = (evt) => {
        if (evt?.data?.type === 'notification:new') void fetchRows();
      };
    } catch {
      /* ignore */
    }
    const onDomPing = () => void fetchRows();
    window.addEventListener('admin:notif:new', onDomPing);
    const poll = setInterval(fetchRows, 10000);
    return () => {
      if (bc) bc.close();
      window.removeEventListener('admin:notif:new', onDomPing);
      clearInterval(poll);
    };
  }, []);

  const unreadCount = rows.filter((r) => !r.readAt).length;

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch('/api/admin/notifications/mark-all-read', { method: 'POST' });
      setRows((prev) => prev.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() })));
    } finally {
      setMarkingAll(false);
    }
  }

  async function markRead(id: string) {
    await fetch(`/api/admin/notifications/${id}`, { method: 'PATCH' });
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, readAt: new Date().toISOString() } : r))
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16
        }}
      >
        <div>
          <h1 style={{ margin: 0 }}>Notifications</h1>
          {unreadCount > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 14, color: '#6b7280' }}>
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            style={{
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#6b7280', padding: '20px 0' }}>Loading…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: '#6b7280', padding: '40px 0', textAlign: 'center', fontSize: 15 }}>
          🔔 No notifications yet
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {rows.map((n) => {
            const km = kindMeta(n.kind);
            const isUnread = !n.readAt;
            return (
              <li
                key={n.id}
                style={{
                  background: isUnread ? '#fefce8' : '#fff',
                  border: `1px solid ${isUnread ? '#fde68a' : '#e5e7eb'}`,
                  borderLeft: `4px solid ${km.color}`,
                  borderRadius: 10,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'flex-start'
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                    {km.icon}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                        marginBottom: 2
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: km.color,
                          background: `${km.color}15`,
                          padding: '2px 6px',
                          borderRadius: 4
                        }}
                      >
                        {km.label}
                      </span>
                      {isUnread && (
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: '#f59e0b',
                            display: 'inline-block'
                          }}
                          title="Unread"
                        />
                      )}
                    </div>

                    <div
                      style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginBottom: 2 }}
                    >
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 13, color: '#4b5563', marginBottom: 4 }}>
                        {n.body}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <time
                        style={{ fontSize: 12, color: '#9ca3af' }}
                        title={new Date(n.createdAt).toLocaleString('en-GB')}
                      >
                        {timeAgo(n.createdAt)} ·{' '}
                        {new Date(n.createdAt).toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </time>
                      {n.link && (
                        <Link
                          href={n.link}
                          style={{
                            fontSize: 12,
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: 600
                          }}
                        >
                          View →
                        </Link>
                      )}
                      <Link
                        href={`/admin/notifications/${n.id}`}
                        style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}
                      >
                        Details
                      </Link>
                      {isUnread && (
                        <button
                          onClick={() => markRead(n.id)}
                          style={{
                            fontSize: 12,
                            color: '#6b7280',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
