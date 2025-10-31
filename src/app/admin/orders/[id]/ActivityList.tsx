'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface Activity {
  id: string;
  orderId: string;
  type: string; // 'NOTE' | 'CANCELLED' | ... (others)
  note: string | null;
  createdAt: string; // ISO string
}

export default function ActivityList({
  orderId,
  initial
}: {
  orderId: string;
  initial: Activity[];
}) {
  const [items, setItems] = useState<Activity[]>(initial);
  const [isPending, start] = useTransition();
  const router = useRouter();

  async function remove(id: string) {
    // find item
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;

    // only allow NOTE
    if (items[idx].type !== 'NOTE') return;

    // optimistic
    const prev = items;
    const next = [...items.slice(0, idx), ...items.slice(idx + 1)];
    setItems(next);

    start(async () => {
      const res = await fetch(
        `/api/admin/orders/${orderId}/activity?noteId=${encodeURIComponent(id)}`,
        {
          method: 'DELETE'
        }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || j?.ok === false) {
        alert(j?.error ?? 'Failed to delete note');
        setItems(prev); // rollback
        return;
      }
      // keep optimistic list; also refresh server data to stay in sync
      router.refresh();
    });
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {items.map((a) => (
        <li key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid #222' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{a.type}</span>
            <span style={{ color: '#888', fontSize: 12 }}>
              {new Date(a.createdAt).toLocaleString('en-GB')}
            </span>

            {a.type === 'NOTE' && (
              <button
                onClick={() => remove(a.id)}
                disabled={isPending}
                title="Delete note"
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  background: 'none',
                  border: 'none',
                  color: '#d33',
                  cursor: isPending ? 'not-allowed' : 'pointer'
                }}
              >
                Delete
              </button>
            )}
          </div>
          {a.note && <div style={{ marginTop: 4 }}>{a.note}</div>}
        </li>
      ))}

      {items.length === 0 && <li style={{ color: '#888' }}>No activity yet.</li>}
    </ul>
  );
}
