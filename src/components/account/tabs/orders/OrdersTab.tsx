// src/components/account/tabs/orders/OrdersTab.tsx
'use client';

import { penceToGBP } from '@/lib/money';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './OrdersTab.module.scss';

export interface OrderBrief {
  id: string;
  displayId: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; imageUrl?: string | null }[];
}

function safeBadgeKey(v: string) {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

function orderStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Order placed',
    PAID: 'Payment received',
    PROCESSING: 'Processing',
    DISPATCHED: 'Dispatched',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
    ON_HOLD: 'On hold'
  };
  return map[s?.toUpperCase()] ?? s;
}

function paymentStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Awaiting payment',
    AUTHORIZED: 'Authorised',
    CAPTURED: 'Payment received',
    PARTIAL_REFUND: 'Partially refunded',
    REFUNDED: 'Refunded',
    FAILED: 'Payment failed'
  };
  return map[s?.toUpperCase()] ?? s;
}

export default function OrdersTab() {
  const [orders, setOrders] = useState<OrderBrief[] | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/account/orders', { cache: 'no-store' });
        const json = (await res.json()) as { ok?: boolean; orders?: OrderBrief[] };
        if (!mounted) return;
        setOrders(json.orders ?? []);
      } catch {
        if (!mounted) return;
        setOrders([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const content = useMemo(() => {
    if (orders === null) return <p className={styles.muted}>Loading your orders…</p>;
    if (orders.length === 0) return <p className={styles.muted}>No orders yet.</p>;

    return (
      <ul className={styles.list}>
        {orders.map((o) => {
          // keep 3 thumbs; allow fallback to default logo if missing
          const thumbs = o.items
            .map((it) => it.imageUrl ?? '/assets/prince-foods-logo.png')
            .filter((x): x is string => typeof x === 'string' && x.length > 0)
            .slice(0, 3);

          const statusKey = safeBadgeKey(o.status);
          const payKey = safeBadgeKey(o.paymentStatus);

          return (
            <li key={o.id} className={styles.li}>
              <Link href={`/account/orders/${o.displayId}`} className={styles.card}>
                <div className={styles.top}>
                  <div className={styles.leftTop}>
                    <span className={styles.id}>#{o.displayId}</span>
                    <span className={styles.date}>
                      {new Date(o.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className={styles.rightTop}>
                    <span className={`${styles.badge} ${styles[`status_${statusKey}`] ?? ''}`}>
                      {orderStatusLabel(o.status)}
                    </span>
                    <span className={`${styles.badgeMuted} ${styles[`pay_${payKey}`] ?? ''}`}>
                      {paymentStatusLabel(o.paymentStatus)}
                    </span>
                    <span className={styles.total}>{penceToGBP(o.grandTotal)}</span>
                  </div>
                </div>

                <div className={styles.bottom}>
                  <div className={styles.thumbStack} aria-hidden="true">
                    {thumbs.length ? (
                      thumbs.map((src, idx) => (
                        <img
                          key={`${o.id}-${idx}`}
                          src={src}
                          alt=""
                          className={styles.thumb}
                          loading="lazy"
                          decoding="async"
                        />
                      ))
                    ) : (
                      <div className={styles.thumbFallback} />
                    )}
                  </div>

                  <div className={styles.items}>
                    {o.items.slice(0, 3).map((it) => (
                      <span key={it.id} className={styles.itemDot}>
                        {it.quantity}× {it.name}
                      </span>
                    ))}
                    {o.items.length > 3 && (
                      <span className={styles.itemDot}>+{o.items.length - 3} more</span>
                    )}
                  </div>

                  <span className={styles.chev} aria-hidden="true">
                    →
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }, [orders]);

  return <div className={styles.wrap}>{content}</div>;
}
