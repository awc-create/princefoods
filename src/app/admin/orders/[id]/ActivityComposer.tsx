// ActivityComposer.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function ActivityComposer({ orderId }: { orderId: string }) {
  const [text, setText] = useState('');
  const [isPending, start] = useTransition();
  const router = useRouter();

  async function submit() {
    const note = text.trim();
    if (!note) return;

    start(async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, type: 'NOTE' })
      });

      const j = await res.json().catch(() => null);
      if (!res.ok || j?.ok === false) {
        alert(j?.error ?? 'Failed to add note');
        return;
      }

      setText('');
      router.refresh(); // re-render the server component to show the new note
    });
  }

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add internal note…"
        rows={3}
        style={{ width: '100%', border: '1px solid #222', borderRadius: 8, padding: 10 }}
      />
      <button
        onClick={submit}
        disabled={isPending || !text.trim()}
        style={{
          border: '1px solid #222',
          borderRadius: 8,
          padding: '8px 12px',
          background: '#111',
          color: '#fff',
          justifySelf: 'start',
          cursor: isPending ? 'not-allowed' : 'pointer'
        }}
      >
        {isPending ? 'Adding…' : 'Add note'}
      </button>
    </div>
  );
}
