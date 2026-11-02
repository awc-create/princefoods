// src/app/admin/layout.tsx
'use client';

import NotificationBell from '@/components/admin/NotificationBell';
import AdminUiProvider from '@/components/admin/ui/AdminUiProvider';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import styles from './Admin.module.scss';
import SetupPush from './SetupPush';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type GroupKey = 'dashboard' | 'site' | 'catalog' | 'operations' | 'marketing' | 'admin';

interface UserWithRole {
  email?: string | null;
  role?: Role | null;
}
const hasRole = (u: unknown): u is UserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

function isActivePath(current: string, href: string) {
  // "/admin" (Overview) must only match exactly, otherwise it would
  // highlight on every admin page via the startsWith check below.
  if (href === '/admin') return current === '/admin';
  return current === href || current.startsWith(`${href}/`);
}

const NAV_OPEN_KEY = 'admin.nav.open';
const NAV_SIMPLE_KEY = 'admin.nav.simple';

/**
 * The handful of pages day-to-day work actually needs. Everything else stays
 * one toggle away — nothing is removed or made inaccessible, it just isn't
 * 22 links deep on first login.
 */
const EVERYDAY_HREFS = new Set([
  '/admin',
  '/admin/orders',
  '/admin/shipments',
  '/admin/returns',
  '/admin/products',
  '/admin/customers'
]);

const isLoginPage = (p: string) =>
  p === '/admin/login' ||
  p.startsWith('/admin/login') ||
  p === '/admin/reset-password' ||
  p.startsWith('/admin/reset-password') ||
  p === '/admin/set-password' ||
  p.startsWith('/admin/set-password');

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const router = useRouter();
  const { data, status } = useSession();
  const role = hasRole(data?.user) ? ((data!.user.role as Role | null) ?? null) : null;

  useEffect(() => {
    if (isLoginPage(pathname)) return;
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace(`/admin/login?callbackUrl=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  // Role-based access
  // HEAD   — full access to everything
  // STAFF  — everything except managing other staff accounts
  // VIEWER — read-only: dashboard, orders, products, customers only
  const isStaff = role === 'HEAD' || role === 'STAFF';
  const isViewer = role === 'VIEWER';

  const [simple, setSimple] = useState(true);

  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: true,
    site: false,
    catalog: false,
    operations: true,
    marketing: false,
    admin: false
  });

  // Restore the simple/full preference
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(NAV_SIMPLE_KEY);
      if (v !== null) setSimple(v === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Restore persisted open/closed state
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(NAV_OPEN_KEY);
      if (raw) setOpen((o) => ({ ...o, ...(JSON.parse(raw) as Record<GroupKey, boolean>) }));
    } catch {
      /* ignore corrupt state */
    }
  }, []);

  const groups = useMemo(() => {
    const list = [
      {
        key: 'dashboard' as GroupKey,
        title: 'Dashboard',
        items: [{ href: '/admin', label: 'Overview' }]
      },
      {
        key: 'site' as GroupKey,
        title: 'Site Editing',
        hide: isViewer,
        items: [
          { href: '/admin/site/home', label: 'Home' },
          { href: '/admin/site/about', label: 'About' },
          { href: '/admin/site/faq', label: 'FAQ' },
          { href: '/admin/site/contact', label: 'Contact' },
          { href: '/admin/media', label: 'Media Library' }
        ]
      },
      {
        key: 'catalog' as GroupKey,
        title: 'Catalog',
        items: [
          { href: '/admin/products', label: 'All Products' },
          ...(isStaff ? [{ href: '/admin/products/create', label: 'Add Product' }] : []),
          { href: '/admin/products/categories', label: 'Categories' },
          { href: '/admin/analytics/products', label: 'Analytics' }
        ]
      },
      {
        key: 'operations' as GroupKey,
        title: 'Operations',
        items: [
          { href: '/admin/orders', label: 'Orders' },
          { href: '/admin/shipments', label: 'Shipments' },
          ...(isStaff ? [{ href: '/admin/shipping', label: 'Delivery Rates' }] : []),
          { href: '/admin/orders/exceptions', label: 'Delivery Exceptions' },
          { href: '/admin/returns', label: 'Returns' },
          { href: '/admin/customers', label: 'Customers' }
        ]
      },
      {
        key: 'marketing' as GroupKey,
        title: 'Marketing',
        hide: isViewer,
        items: [
          // One door. The hub explains the three types in plain English and
          // routes onward — the engines behind them are unchanged.
          { href: '/admin/discounts', label: 'Discounts' },
          { href: '/admin/promotions', label: '• Discount codes' },
          { href: '/admin/offers', label: '• Automatic offers' },
          { href: '/admin/customer-discounts', label: '• Customer discounts' }
        ]
      },
      {
        key: 'admin' as GroupKey,
        title: 'Admin',
        items: [
          { href: '/admin/guide', label: '📖 Guide' },
          { href: '/admin/notifications', label: 'Notifications' },
          // Password change lives in Settings → Password; no separate nav item.
          { href: '/admin/settings', label: 'Settings' }
        ]
      }
    ];
    const visible = list.filter((g) => !g.hide);
    if (!simple) return visible;

    // Simple view: only the pages used day to day.
    return visible
      .map((g) => ({ ...g, items: g.items.filter((it) => EVERYDAY_HREFS.has(it.href)) }))
      .filter((g) => g.items.length > 0);
  }, [isStaff, isViewer, simple]);

  // Auto-expand the group containing the current page so the active
  // link is never hidden inside a collapsed group.
  useEffect(() => {
    const g = groups.find((grp) => grp.items.some((it) => isActivePath(pathname, it.href)));
    if (g && !open[g.key]) {
      setOpen((o) => ({ ...o, [g.key]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, groups]);

  if (isLoginPage(pathname)) return <>{children}</>;

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;
  }

  const toggle = (k: GroupKey) =>
    setOpen((o) => {
      const next = { ...o, [k]: !o[k] };
      try {
        window.localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });

  function toggleSimple() {
    setSimple((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(NAV_SIMPLE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    window.location.assign('/admin/login');
  }

  return (
    <div className={styles.adminWrapper}>
      <aside className={styles.adminSidebar}>
        {hasRole(data?.user) && data?.user?.email && (
          <div className={styles.loggedInRow}>
            <div className={styles.loggedIn}>
              Logged in as:
              <br />
              <strong>{data.user.email}</strong>
              {role && <span className={styles.rolePill}>{role}</span>}
            </div>
            <NotificationBell />
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key} className={styles.group}>
            <button
              type="button"
              className={styles.groupHeaderBtn}
              aria-expanded={open[g.key]}
              onClick={() => toggle(g.key)}
            >
              <span className={styles.groupTitle}>{g.title}</span>
              <span className={styles.groupIcon} aria-hidden>
                {open[g.key] ? '−' : '+'}
              </span>
            </button>
            {open[g.key] && (
              <nav className={styles.nav}>
                {g.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`${styles.navLink} ${isActivePath(pathname, it.href) ? styles.active : ''}`}
                  >
                    {it.label}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        ))}

        {/* Simple ⇄ everything. Nothing is hidden permanently. */}
        <div className={styles.group}>
          <nav className={styles.nav}>
            <button
              type="button"
              onClick={toggleSimple}
              className={styles.navLink}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                opacity: 0.85,
                fontSize: 13
              }}
              title={
                simple
                  ? 'Show site editing, categories, analytics, delivery rates and settings'
                  : 'Show only the pages used day to day'
              }
            >
              {simple ? '⋯ Show everything' : '↑ Show less'}
            </button>
          </nav>
        </div>

        <div className={styles.group}>
          <nav className={styles.nav}>
            <button
              type="button"
              onClick={handleSignOut}
              className={styles.navLink}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Log Out
            </button>
          </nav>
        </div>
      </aside>

      <main className={styles.adminMain}>
        <AdminUiProvider>
          <SetupPush />
          {children}
        </AdminUiProvider>
      </main>
    </div>
  );
}
