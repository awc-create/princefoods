'use client';
// src/app/admin/AdminShell.tsx
// All the client-side logic (useSession, usePathname, sidebar state) lives
// here. The layout itself stays a Server Component to avoid the Next.js
// 15.3.x clientModules RSC manifest bug caused by 'use client' layouts.

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

export default function AdminShell({ children }: { children: React.ReactNode }) {
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

  // Login page — no sidebar
  if (isLoginPage(pathname)) return <>{children}</>;

  // Loading / unauthenticated — blank while redirect fires
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
