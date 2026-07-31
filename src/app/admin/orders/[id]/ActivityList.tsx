// src/app/admin/orders/[id]/ActivityList.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState, useTransition } from 'react';

type ActivityType =
  | 'PLACED'
  | 'PAID'
  | 'FULFILLED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'NOTE'
  | 'SHIPMENT_CREATED'
  | 'LABEL_PURCHASED'
  | 'SHIPMENT_SHIPPED'
  | 'SHIPMENT_CANCELLED'
  | 'SHIPMENT_DELIVERED'
  | 'RETURN_OPENED'
  | 'RETURN_RECEIVED'
  | 'RETURN_RESHIP_CREATED'
  | 'RETURN_DECIDED_REFUND'
  | 'RETURN_DECIDED_STORE_CREDIT'
  | 'RETURN_CLOSED'
  | 'TAG_ADDED'
  | 'TAG_REMOVED'
  | string;

interface Activity {
  id: string;
  orderId: string;
  type: ActivityType;
  note: string | null;
  createdAt: string; // ISO
  meta?: unknown;
}

function prettyWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB');
  } catch {
    return iso;
  }
}

function iconFor(type: string) {
  switch (type) {
    case 'PLACED':
      return '🛒';
    case 'PAID':
      return '💳';
    case 'FULFILLED':
      return '✅';
    case 'REFUNDED':
      return '💸';
    case 'CANCELLED':
      return '🛑';

    case 'SHIPMENT_CREATED':
      return '📦';
    case 'LABEL_PURCHASED':
      return '🏷️';
    case 'SHIPMENT_SHIPPED':
      return '🚚';
    case 'SHIPMENT_DELIVERED':
      return '📬';
    case 'SHIPMENT_CANCELLED':
      return '❌';

    case 'RETURN_OPENED':
      return '↩️';
    case 'RETURN_RECEIVED':
      return '📥';
    case 'RETURN_RESHIP_CREATED':
      return '🔁';
    case 'RETURN_DECIDED_REFUND':
      return '🧾';
    case 'RETURN_DECIDED_STORE_CREDIT':
      return '🎟️';
    case 'RETURN_CLOSED':
      return '🔒';

    case 'TAG_ADDED':
      return '🏷️';
    case 'TAG_REMOVED':
      return '🧹';

    case 'NOTE':
      return '📝';
    default:
      return '•';
  }
}

function titleFor(type: string) {
  switch (type) {
    case 'PLACED':
      return 'Order placed';
    case 'PAID':
      return 'Payment captured';
    case 'FULFILLED':
      return 'Fulfilled';
    case 'REFUNDED':
      return 'Refunded';
    case 'CANCELLED':
      return 'Cancelled';

    case 'SHIPMENT_CREATED':
      return 'Shipment created';
    case 'LABEL_PURCHASED':
      return 'Label purchased';
    case 'SHIPMENT_SHIPPED':
      return 'Shipment marked as shipped';
    case 'SHIPMENT_DELIVERED':
      return 'Shipment delivered';
    case 'SHIPMENT_CANCELLED':
      return 'Shipment cancelled';

    case 'RETURN_OPENED':
      return 'Return case opened';
    case 'RETURN_RECEIVED':
      return 'Return received';
    case 'RETURN_RESHIP_CREATED':
      return 'Reship created';
    case 'RETURN_DECIDED_REFUND':
      return 'Return decision: refund';
    case 'RETURN_DECIDED_STORE_CREDIT':
      return 'Return decision: store credit';
    case 'RETURN_CLOSED':
      return 'Return case closed';

    case 'TAG_ADDED':
      return 'Tag added';
    case 'TAG_REMOVED':
      return 'Tag removed';

    case 'NOTE':
      return 'Note';
    default:
      return type;
  }
}

function toneFor(type: string): 'ok' | 'warn' | 'danger' | 'muted' {
  if (type === 'REFUNDED' || type === 'CANCELLED' || type === 'SHIPMENT_CANCELLED') return 'danger';
  if (type.startsWith('RETURN_')) return type === 'RETURN_CLOSED' ? 'muted' : 'warn';
  if (
    type === 'PAID' ||
    type === 'FULFILLED' ||
    type === 'LABEL_PURCHASED' ||
    type === 'SHIPMENT_DELIVERED'
  )
    return 'ok';
  if (
    type === 'PLACED' ||
    type === 'NOTE' ||
    type.startsWith('TAG_') ||
    type === 'SHIPMENT_CREATED'
  )
    return 'muted';
  return 'muted';
}

function TonePill({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }) {
  const styles: Record<typeof tone, React.CSSProperties> = {
    ok: {
      background: 'rgba(16,185,129,0.10)',
      border: '1px solid rgba(16,185,129,0.22)',
      color: '#065f46'
    },
    warn: {
      background: 'rgba(245,158,11,0.10)',
      border: '1px solid rgba(245,158,11,0.22)',
      color: '#92400e'
    },
    danger: {
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.22)',
      color: '#991b1b'
    },
    muted: {
      background: 'rgba(15,23,42,0.04)',
      border: '1px solid rgba(15,23,42,0.08)',
      color: 'rgba(15,23,42,0.65)'
    }
  };

  return (
    <span
      style={{
        ...styles[tone],
        fontSize: 12,
        fontWeight: 950,
        padding: '2px 8px',
        borderRadius: 999
      }}
    >
      {text}
    </span>
  );
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
  const { toast } = useAdminUi();

  const sorted = useMemo(() => {
    return [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [items]);

  async function remove(id: string) {
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return;

    // Only allow NOTE deletion
    if (items[idx].type !== 'NOTE') return;

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
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || j?.ok === false) {
        toast.error(j?.error ?? 'Failed to delete note');
        setItems(prev);
        return;
      }

      router.refresh();
    });
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {sorted.map((a) => {
        const type = String(a.type);
        const title = titleFor(type);
        const tone = toneFor(type);
        const icon = iconFor(type);

        return (
          <li
            key={a.id}
            style={{ padding: '10px 0', borderBottom: '1px solid rgba(15,23,42,0.10)' }}
          >
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14 }}>{icon}</span>

              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 950, color: '#0f172a' }}>{title}</span>
                <TonePill text={type} tone={tone} />
                <span style={{ color: 'rgba(15,23,42,0.55)', fontSize: 12 }}>
                  {prettyWhen(a.createdAt)}
                </span>
              </div>

              {a.type === 'NOTE' && (
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={isPending}
                  title="Delete note"
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    background: 'none',
                    border: 'none',
                    color: '#b91c1c',
                    fontWeight: 900,
                    cursor: isPending ? 'not-allowed' : 'pointer'
                  }}
                >
                  Delete
                </button>
              )}
            </div>

            {a.note ? (
              <div
                style={{
                  marginTop: 6,
                  color: 'rgba(15,23,42,0.85)',
                  fontSize: 13,
                  fontWeight: 650
                }}
              >
                {a.note}
              </div>
            ) : null}
          </li>
        );
      })}

      {sorted.length === 0 ? (
        <li style={{ color: 'rgba(15,23,42,0.55)' }}>No activity yet.</li>
      ) : null}
    </ul>
  );
}
