// src/app/admin/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import styles from './Admin.module.scss';
import RecentNotifications from './RecentNotifications';
import WorkQueue from './WorkQueue';

interface Stats {
  products: number;
  customers: number;
  orders: number;
  revenuePence: number;
}

type ApcStatus = 'UP' | 'DEGRADED' | 'DOWN';

interface ApcHealthResp {
  ok: boolean;
  apc?: {
    status: ApcStatus;
    environment?: string;
    latencyMs?: number;
    httpStatus?: number;
    error?: string;
  };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsErr, setStatsErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'all'>('month');

  const [apcHealth, setApcHealth] = useState<ApcHealthResp | null>(null);
  const [apcLoading, setApcLoading] = useState(true);


  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setStatsErr(null);
      try {
        const res = await fetch(`/api/admin/stats?period=${period}`, { cache: 'no-store' });
        const data: {
          ok?: boolean;
          products?: number;
          customers?: number;
          orders?: number;
          newOrdersToday?: number;
          revenuePence?: number;
        } = await res.json();

        if (cancelled) return;

        if (res.ok && data && data.ok) {
          setStats({
            products: data.products ?? 0,
            customers: data.customers ?? 0,
            orders: data.orders ?? 0,
            revenuePence: data.revenuePence ?? 0
          });
        } else {
          // Don't render zeros that look like real (bad) numbers.
          setStats(null);
          setStatsErr(`Couldn't load stats (HTTP ${res.status}).`);
        }
      } catch (e) {
        if (!cancelled) {
          setStats(null);
          setStatsErr(e instanceof Error ? e.message : "Couldn't load stats.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [period]);


  useEffect(() => {
    let cancelled = false;

    async function loadApc() {
      try {
        const res = await fetch('/api/healthz/apc', { cache: 'no-store' });
        const data: ApcHealthResp = await res.json();
        if (!cancelled) setApcHealth(data);
      } catch (e) {
        if (!cancelled) {
          setApcHealth({
            ok: false,
            apc: { status: 'DOWN', error: e instanceof Error ? e.message : 'Fetch failed' }
          });
        }
      } finally {
        if (!cancelled) setApcLoading(false);
      }
    }

    loadApc();
    const id = window.setInterval(loadApc, 60_000); // refresh every 60s

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const formatGBP = (pence: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(
      (pence ?? 0) / 100
    );

  const apcStatus: ApcStatus | 'UNKNOWN' = useMemo(() => {
    if (apcLoading) return 'UNKNOWN';
    return apcHealth?.apc?.status ?? 'UNKNOWN';
  }, [apcLoading, apcHealth]);

  const apcTitle = useMemo(() => {
    if (apcLoading) return 'Checking APC…';
    if (apcStatus === 'UP') return 'APC is up';
    if (apcStatus === 'DEGRADED') return 'APC is degraded';
    if (apcStatus === 'DOWN') return 'APC is down';
    return 'APC status unknown';
  }, [apcLoading, apcStatus]);

  const apcHint = useMemo(() => {
    if (apcLoading) return 'Running ServiceAvailability…';
    if (apcStatus === 'UP') return 'ServiceAvailability ok';
    const http = apcHealth?.apc?.httpStatus ? `HTTP ${apcHealth.apc.httpStatus}` : '';
    const err = apcHealth?.apc?.error ?? '';
    return [http, err].filter(Boolean).join(' — ').slice(0, 140) || 'Error';
  }, [apcLoading, apcStatus, apcHealth]);

  return (
    <div>
      {/* What needs doing — the reason most staff open this page. */}
      <WorkQueue />

      <div className={styles.dashboardHeader}>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Business summary</h2>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {(['today', 'week', 'month', 'year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontWeight: period === p ? 700 : 400,
                background: period === p ? '#111827' : '#fff',
                color: period === p ? '#fff' : '#374151',
                cursor: 'pointer',
                fontSize: 13
              }}
            >
              {p === 'all'
                ? 'All time'
                : p === 'today'
                  ? 'Today'
                  : p === 'week'
                    ? '7 days'
                    : p === 'month'
                      ? '30 days'
                      : '1 year'}
            </button>
          ))}
        </div>
      </div>

      {statsErr && (
        <div
          style={{
            margin: '10px 0',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #fecaca',
            background: '#fef2f2',
            color: '#991b1b',
            fontWeight: 600,
            fontSize: 14
          }}
        >
          {statsErr} Refresh to retry.
        </div>
      )}

      {/* ✅ 4 cards, each linking to its section */}
      <div className={styles.dashboardStats}>
        <Link href="/admin/products" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.statCard}>
            <h2>Products</h2>
            <p>{loading ? '...' : statsErr ? '—' : (stats?.products ?? 0)}</p>
          </div>
        </Link>

        <Link href="/admin/customers" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.statCard}>
            <h2>Customers</h2>
            <p>{loading ? '...' : statsErr ? '—' : (stats?.customers ?? 0)}</p>
          </div>
        </Link>

        <Link href="/admin/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.statCard}>
            <h2>Orders</h2>
            <p>{loading ? '...' : statsErr ? '—' : (stats?.orders ?? 0)}</p>
          </div>
        </Link>

        <Link href="/admin/orders" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className={styles.statCard}>
            <h2>Revenue</h2>
            <p>{loading ? '...' : statsErr ? '—' : formatGBP(stats?.revenuePence ?? 0)}</p>
          </div>
        </Link>
      </div>


      {/* ✅ Status bar UNDER the cards (not inside the grid) */}
      <div className={styles.systemRow}>
        <div className={styles.systemItem}>
          <span
            className={`${styles.dot} ${
              apcLoading
                ? styles.dotIdle
                : apcStatus === 'UP'
                  ? styles.dotUp
                  : apcStatus === 'DEGRADED'
                    ? styles.dotWarn
                    : styles.dotDown
            }`}
            aria-hidden="true"
          />

          <div className={styles.systemMain}>
            <div className={styles.systemTop}>
              <span className={styles.systemLabel}>Shipping Carrier</span>
              <span className={styles.systemTitle}>{apcTitle}</span>
            </div>

            <div className={styles.systemBottom}>
              <span className={styles.systemBrand}>APC</span>

              {apcHealth?.apc?.environment ? (
                <span className={styles.systemPill}>{apcHealth.apc.environment}</span>
              ) : null}

              {typeof apcHealth?.apc?.latencyMs === 'number' ? (
                <span className={styles.systemPill}>{apcHealth.apc.latencyMs}ms</span>
              ) : null}

              {apcStatus !== 'UP' && apcHealth?.apc?.httpStatus ? (
                <span className={styles.systemPill}>HTTP {apcHealth.apc.httpStatus}</span>
              ) : null}

              <span className={styles.systemHint}>{apcHint}</span>
            </div>
          </div>
        </div>
      </div>

      <RecentNotifications limit={3} />
    </div>
  );
}

