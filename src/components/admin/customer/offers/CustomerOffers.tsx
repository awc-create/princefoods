// src/components/admin/customer/offers/CustomerOffers.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './CustomerOffers.module.scss';

interface Row {
  id: string;
  offerId: string;
  offerName: string;
  offerKind: string | null;
  discountPence: number;
  appliedAt: string;
  order: {
    id: string;
    displayId: string | null;
    status: string;
    paymentStatus: string | null;
  } | null;
}

function money(pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
    (pence ?? 0) / 100
  );
}

export default function CustomerOffers({ customerId }: { customerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [totalUses, setTotalUses] = useState(0);
  const [totalDiscountPence, setTotalDiscountPence] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers/${customerId}/offers`, { cache: 'no-store' });
        const json = await res.json();
        if (ignore) return;
        if (json?.ok) {
          setRows(json.rows ?? []);
          setTotalUses(json.totalUses ?? 0);
          setTotalDiscountPence(json.totalDiscountPence ?? 0);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [customerId]);

  const topOffers = useMemo(() => {
    const map = new Map<string, { name: string; count: number; discountPence: number }>();
    for (const r of rows) {
      const cur = map.get(r.offerId) ?? { name: r.offerName, count: 0, discountPence: 0 };
      cur.count += 1;
      cur.discountPence += r.discountPence ?? 0;
      map.set(r.offerId, cur);
    }
    return Array.from(map.entries())
      .map(([offerId, v]) => ({ offerId, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [rows]);

  return (
    <div>
      <h3>Offers</h3>

      {loading ? (
        <p className={styles.muted}>Loading…</p>
      ) : (
        <>
          <ul className={styles.kpis}>
            <li>
              <strong>Used</strong>
              <span>{totalUses}</span>
            </li>
            <li>
              <strong>Total offer discount</strong>
              <span>{money(totalDiscountPence)}</span>
            </li>
          </ul>

          {topOffers.length > 0 && (
            <div className={styles.top}>
              <div className={styles.subhead}>Top offers</div>
              <ul className={styles.topList}>
                {topOffers.map((o) => (
                  <li key={o.offerId}>
                    <strong>{o.name}</strong>
                    <span>· {o.count} uses</span>
                    <span>· {money(o.discountPence)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rows.length === 0 ? (
            <p className={styles.muted}>No offers used.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Offer</th>
                    <th>Discount</th>
                    <th>Order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 30).map((r) => (
                    <tr key={r.id}>
                      <td>{new Date(r.appliedAt).toLocaleString('en-GB')}</td>
                      <td>
                        {r.offerName}
                        {r.offerKind ? <span className={styles.badge}> {r.offerKind}</span> : null}
                      </td>
                      <td>{money(r.discountPence)}</td>
                      <td>
                        {r.order ? (
                          <Link href={`/admin/orders/${r.order.id}`}>
                            {r.order.displayId ?? r.order.id}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
