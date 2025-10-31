'use client';

import { useState, useTransition } from 'react';

interface Tag {
  slug: string;
  label: string;
  color?: string;
}

export default function TagEditor({ orderId, initial }: { orderId: string; initial: Tag[] }) {
  const [list, setList] = useState<Tag[]>(initial);
  const [input, setInput] = useState('');
  const [isPending, start] = useTransition();

  async function add(slugOrLabel: string) {
    const res = await fetch(`/api/admin/orders/${orderId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: slugOrLabel, label: slugOrLabel })
    });
    const j = await res.json();
    if (j?.ok && j.tag) setList((prev) => [...prev, j.tag]);
  }

  async function remove(slug: string) {
    await fetch(`/api/admin/orders/${orderId}/tags/${encodeURIComponent(slug)}`, {
      method: 'DELETE'
    });
    setList((prev) => prev.filter((t) => t.slug !== slug));
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {list.map((t) => (
          <button
            key={t.slug}
            onClick={() => remove(t.slug)}
            title="Remove tag"
            style={{
              border: '1px solid #222',
              borderRadius: 999,
              padding: '4px 10px',
              background: t.color ?? '#111',
              color: '#fff',
              fontSize: 12
            }}
          >
            {t.label}
            <span style={{ marginLeft: 8, opacity: 0.8 }}>✕</span>
          </button>
        ))}
        {list.length === 0 && <span style={{ color: '#888' }}>No tags</span>}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add tag… (e.g. VIP, Test, Bulk)"
          style={{ flex: 1, border: '1px solid #222', borderRadius: 8, padding: '8px 10px' }}
        />
        <button
          onClick={() => input.trim() && start(() => add(input.trim()))}
          disabled={isPending || !input.trim()}
          style={{
            border: '1px solid #222',
            borderRadius: 8,
            padding: '8px 12px',
            background: '#111',
            color: '#fff'
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
