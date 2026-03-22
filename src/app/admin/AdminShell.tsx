'use client';
// src/app/admin/AdminShell.tsx

import NotificationBell from '@/components/admin/NotificationBell';
import { useSession } from 'next-auth/react';
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
  return current === href || current.startsWith(`${href}/`);
}

const isLoginPage = (p: string) => p === '/admin/login' || p.startsWith('/admin/login');

// ── Error boundary ────────────────────────────────────────────────────────────
class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AdminShell crash]', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '2rem',
            fontFamily: 'monospace',
            background: '#1a1a1a',
            color: '#f87171',
            minHeight: '100vh'
          }}
        >
          <h2>AdminShell crashed</h2>
          <p style={{ color: '#fbbf24' }}>{this.state.error.message}</p>
          <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Shell UI ──────────────────────────────────────────────────────────────────
function AdminShellInner({ children }: { children: React.ReactNode }) {
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

  const canEditSite = role === 'HEAD' || role === 'STAFF';
  const canManageAdmin = role === 'HEAD';
  const canManageMarketing = role === 'HEAD' || role === 'STAFF';

  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: false,
    site: true,
    catalog: false,
    operations: true,
    marketing: true,
    admin: false
  });

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
        hide: !canEditSite,
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
          ...(canEditSite ? [{ href: '/admin/products/create', label: 'Add Product' }] : []),
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
          { href: '/admin/shipping', label: 'Shipping' },
          { href: '/admin/orders/exceptions', label: 'Delivery Exceptions' },
          { href: '/admin/customers', label: 'Customers' }
        ]
      },
      {
        key: 'marketing' as GroupKey,
        title: 'Marketing',
        hide: !canManageMarketing,
        items: [
          { href: '/admin/promotions', label: 'Promotions' },
          { href: '/admin/offers', label: 'Offers' },
          { href: '/admin/customer-discounts', label: 'Customer Discounts' }
        ]
      },
      {
        key: 'admin' as GroupKey,
        title: 'Admin',
        hide: !canManageAdmin,
        items: [
          { href: '/admin/notifications', label: 'Notifications' },
          { href: '/admin/settings', label: 'Settings' }
        ]
      }
    ];
    return list.filter((g) => !g.hide);
  }, [canEditSite, canManageAdmin, canManageMarketing]);

  if (isLoginPage(pathname)) return <>{children}</>;

  if (status === 'loading' || status === 'unauthenticated') {
    return <div style={{ padding: '2rem', color: '#6b7280' }}>Loading…</div>;
  }

  const toggle = (k: GroupKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

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

        <div className={styles.group}>
          <nav className={styles.nav}>
            <Link href="/api/auth/signout?callbackUrl=/admin/login" className={styles.navLink}>
              Log Out
            </Link>
          </nav>
        </div>
      </aside>

      <main className={styles.adminMain}>
        <SetupPush />
        {children}
      </main>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────
export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminErrorBoundary>
      <AdminShellInner>{children}</AdminShellInner>
    </AdminErrorBoundary>
  );
}
