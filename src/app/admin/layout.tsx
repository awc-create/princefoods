// src/app/admin/layout.tsx
'use client';

import NotificationBell from '@/components/admin/NotificationBell';
import SetupPush from './SetupPush';

import '@/styles/Global.scss';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import styles from './Admin.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type GroupKey = 'dashboard' | 'site' | 'catalog' | 'operations' | 'marketing' | 'admin';

interface UserWithRole {
  email?: string | null;
  role?: Role | null;
}
const hasRole = (u: unknown): u is UserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);

const isLoginPath = (p?: string | null) => p === '/admin/login' || p === '/admin/login/';

function isActivePath(current: string, href: string) {
  return current === href || current.startsWith(`${href}/`);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const safePath = pathname ?? '/admin';
  const onLogin = isLoginPath(safePath);

  // Session is READ-ONLY here — middleware already blocked unauthenticated access
  // No redirect logic, no loading gate = no flash
  const { data } = useSession();
  const role = hasRole(data?.user) ? ((data!.user.role as Role | null) ?? null) : null;

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
    const list: Array<{
      key: GroupKey;
      title: string;
      items: Array<{ href: string; label: string }>;
      hide?: boolean;
    }> = [
      { key: 'dashboard', title: 'Dashboard', items: [{ href: '/admin', label: 'Overview' }] },
      {
        key: 'site',
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
        key: 'catalog',
        title: 'Catalog',
        items: [
          { href: '/admin/products', label: 'All Products' },
          ...(canEditSite ? [{ href: '/admin/products/create', label: 'Add Product' }] : []),
          { href: '/admin/products/categories', label: 'Categories' },
          { href: '/admin/analytics/products', label: 'Analytics' }
        ]
      },
      {
        key: 'operations',
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
        key: 'marketing',
        title: 'Marketing',
        hide: !canManageMarketing,
        items: [
          { href: '/admin/promotions', label: 'Promotions' },
          { href: '/admin/offers', label: 'Offers' },
          { href: '/admin/customer-discounts', label: 'Customer Discounts' }
        ]
      },
      {
        key: 'admin',
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

  if (onLogin) return <>{children}</>;

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
                    className={`${styles.navLink} ${isActivePath(safePath, it.href) ? styles.active : ''}`}
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
