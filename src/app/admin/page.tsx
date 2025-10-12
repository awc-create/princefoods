// src/app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import styles from './Admin.module.scss';
import RecentNotifications from './RecentNotifications';
import SetupPush from './SetupPush';

interface Stats {
  products: number;
  customers: number;
  orders: number;
  revenuePence: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch('/api/admin/stats', { cache: 'no-store' });
        const data: {
          ok?: boolean;
          products?: number;
          customers?: number;
          orders?: number;
          revenuePence?: number;
        } = await res.json();

        if (cancelled) return;

        if (data && data.ok) {
          setStats({
            products: data.products ?? 0,
            customers: data.customers ?? 0,
            orders: data.orders ?? 0,
            revenuePence: data.revenuePence ?? 0
          });
        } else {
          setStats({ products: 0, customers: 0, orders: 0, revenuePence: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
      (pence ?? 0) / 100
    );

  return (
    <div>
      <SetupPush />
      <h1>Admin Dashboard</h1>

      <div className={styles.dashboardStats}>
        <div className={styles.statCard}>
          <h2>Products</h2>
          <p>{loading ? '...' : (stats?.products ?? 0)}</p>
        </div>
        <div className={styles.statCard}>
          <h2>Customers</h2>
          <p>{loading ? '...' : (stats?.customers ?? 0)}</p>
        </div>
        <div className={styles.statCard}>
          <h2>Orders</h2>
          <p>{loading ? '...' : (stats?.orders ?? 0)}</p>
        </div>
        <div className={styles.statCard}>
          <h2>Revenue</h2>
          <p>{loading ? '...' : formatGBP(stats?.revenuePence ?? 0)}</p>
        </div>
      </div>

      <RecentNotifications limit={3} />
    </div>
  );
}
