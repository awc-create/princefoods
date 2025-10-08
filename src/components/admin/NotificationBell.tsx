// src/components/admin/NotificationBell.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

interface Noti {
  id: string;
  createdAt: string;
  kind: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const unread = items.filter((n) => !n.readAt).length;

  const load = async (opts?: { append?: boolean; cursor?: string | null }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('take', '20');
      if (opts?.cursor ?? nextCursor) qs.set('cursor', String(opts?.cursor ?? nextCursor));
      const res = await fetch(`/api/admin/notifications?${qs.toString()}`, { cache: 'no-store' });
      const j = await res.json();
      if (j.ok) {
        setItems((prev) => (opts?.append ? [...prev, ...j.data] : j.data));
        setNextCursor(j.nextCursor);
      }
    } finally {
      setLoading(false);
    }
  };

  // initial + polling
  useEffect(() => {
    load();
    pollRef.current = window.setInterval(() => load(), 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAllRead = async () => {
    const ids = items.filter((n) => !n.readAt).map((n) => n.id);
    if (!ids.length) return;
    await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
    );
  };

  const markOneRead = async (id: string) => {
    await fetch(`/api/admin/notifications/${id}`, { method: 'PATCH' });
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
  };

  return (
    <div className="relative">
      <button
        className="relative rounded-md px-2 py-1"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white rounded-full px-1">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] overflow-auto rounded-xl shadow-xl bg-white border z-50">
          <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center justify-between">
            <strong className="text-sm">Notifications</strong>
            <div className="flex gap-2">
              <button className="text-xs underline" onClick={markAllRead}>
                Mark all read
              </button>
              <button className="text-xs underline" onClick={() => load()}>
                Refresh
              </button>
            </div>
          </div>

          {items.length === 0 && (
            <div className="px-3 py-6 text-sm text-gray-500">No notifications yet.</div>
          )}

          <ul className="divide-y">
            {items.map((n) => (
              <li key={n.id} className="px-3 py-2 hover:bg-gray-50">
                <a href={n.link ?? '#'} className="block" onClick={() => markOneRead(n.id)}>
                  <div className="flex items-start gap-2">
                    {!n.readAt ? (
                      <span className="mt-1 w-2 h-2 rounded-full bg-blue-600" />
                    ) : (
                      <span className="mt-1 w-2 h-2" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-gray-600">{n.body}</div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>

          <div className="px-3 py-2">
            {nextCursor ? (
              <button
                className="text-sm underline disabled:opacity-50"
                disabled={loading}
                onClick={() => load({ append: true })}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <span className="text-xs text-gray-400">End of list</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
