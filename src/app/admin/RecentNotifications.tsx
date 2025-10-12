'use client';

import { AlertTriangle, Bell, ChevronRight, Cog, Edit3, Info } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Noti {
  id: string;
  createdAt: string; // ISO
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
}

function timeAgo(iso: string) {
  const now = Date.now();
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.round((now - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function kindIcon(kind: string) {
  const k = (kind || '').toLowerCase();
  if (k.includes('error') || k.includes('fail') || k.includes('alert')) return AlertTriangle;
  if (k.includes('faq') || k.includes('content') || k.includes('edit')) return Edit3;
  if (k.includes('home') || k.includes('settings') || k.includes('config')) return Cog;
  if (k.includes('info') || k.includes('update')) return Info;
  return Bell;
}

function kindColor(kind: string) {
  const k = (kind || '').toLowerCase();
  if (k.includes('error') || k.includes('fail') || k.includes('alert')) return '#e74c3c';
  if (k.includes('settings') || k.includes('config') || k.includes('home')) return '#2e86de';
  if (k.includes('faq') || k.includes('content') || k.includes('edit')) return '#27ae60';
  return '#d35400';
}

export default function RecentNotifications({ limit = 3 }: { limit?: number }) {
  const [items, setItems] = useState<Noti[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/admin/notifications?limit=${limit}`, { cache: 'no-store' });
        const j = await r.json();
        if (!cancelled && j?.ok) setItems(j.data as Noti[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const list = useMemo(() => items.slice(0, limit), [items, limit]);

  return (
    <section style={{ marginTop: '1.5rem' }}>
      <h2 style={{ margin: '0 0 .75rem', fontSize: 22, fontWeight: 700 }}>Recent notifications</h2>

      {loading && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {Array.from({ length: limit }).map((_, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid #eee'
              }}
            >
              <div style={{ width: 28, height: 28, borderRadius: 8, background: '#f0f0f0' }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, width: '30%', background: '#f0f0f0', borderRadius: 6 }} />
                <div
                  style={{
                    height: 10,
                    width: '60%',
                    marginTop: 8,
                    background: '#f5f5f5',
                    borderRadius: 6
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && list.length === 0 && <div style={{ color: '#666' }}>No notifications yet.</div>}

      {!loading && list.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {list.map((n) => {
            const Icon = kindIcon(n.kind || n.title || '');
            const color = kindColor(n.kind || n.title || '');

            const RowInner = (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                  padding: '10px 0',
                  borderBottom: '1px solid #eee'
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${color}1A`,
                    display: 'grid',
                    placeItems: 'center',
                    color
                  }}
                >
                  <Icon size={16} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color,
                        lineHeight: 1.2,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={n.title}
                    >
                      {n.title}
                    </span>
                    {n.kind && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: 999,
                          background: '#f6f6f6',
                          border: '1px solid #eee',
                          color: '#666',
                          textTransform: 'uppercase',
                          letterSpacing: 0.3
                        }}
                        title={n.kind}
                      >
                        {n.kind}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#999' }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>

                  {n.body && (
                    <div
                      style={{
                        marginTop: 4,
                        color: '#444',
                        fontSize: 14,
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                      title={n.body}
                    >
                      {n.body}
                    </div>
                  )}

                  {/* If the whole row is a link, show a non-anchor cue here */}
                  {n.link && (
                    <div
                      style={{
                        marginTop: 6,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color
                      }}
                    >
                      <span style={{ fontSize: 13 }}>Open</span>
                      <ChevronRight size={14} />
                    </div>
                  )}
                </div>
              </div>
            );

            return (
              <li key={n.id}>
                {n.link ? (
                  // Make the whole row the only anchor (no nested <a> inside)
                  <Link href={n.link} style={{ textDecoration: 'none', color: 'inherit' }}>
                    {RowInner}
                  </Link>
                ) : (
                  RowInner
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ marginTop: '.5rem' }}>
        {/* This is not a real navigation link; prevent default or point to a dedicated page later */}
        <a
          href="#notifications"
          onClick={(e) => e.preventDefault()}
          style={{ fontSize: '.9rem', color: '#e74c3c' }}
        >
          View all in bell menu ↑
        </a>
      </div>
    </section>
  );
}
