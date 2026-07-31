// src/components/admin/orders/ActivityComposer.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export default function ActivityComposer({ orderId }: { orderId: string }) {
  const [text, setText] = useState('');
  const [isPending, start] = useTransition();
  const router = useRouter();
  const { toast } = useAdminUi();

  async function submit() {
    const note = text.trim();
    if (!note) return;

    start(async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, type: 'NOTE' })
      });

      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || j?.ok === false) {
        toast.error(j?.error ?? 'Failed to add note');
        return;
      }

      setText('');
      router.refresh();
    });
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add internal note…"
        rows={3}
        style={{
          width: '100%',
          border: '1px solid rgba(15,23,42,0.14)',
          borderRadius: 12,
          padding: 10,
          background: '#fff'
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending || !text.trim()}
        style={{
          height: 40,
          border: '1px solid rgba(2,6,23,0.9)',
          borderRadius: 12,
          padding: '0 14px',
          background: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
          color: '#fff',
          fontWeight: 950,
          justifySelf: 'start',
          cursor: isPending ? 'not-allowed' : 'pointer',
          opacity: isPending ? 0.75 : 1
        }}
      >
        {isPending ? 'Adding…' : 'Add note'}
      </button>
    </div>
  );
}
