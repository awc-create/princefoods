// src/app/admin/AdminLayout.tsx
'use client';

import NotificationBell from '@/components/admin/NotificationBell';
import SetupPush from './SetupPush';

import '@/styles/Global.scss';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import styles from './Admin.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

// ✅ Improved grouping (adds Promotions + makes sections cleaner)
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

  const router = useRouter();
  const { status, data } = useSession();

  const [role, setRole] = useState<Role | null>(null);

  // sensible defaults (operations + marketing visible)
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: false,
    site: true,
    catalog: false,
    operations: true,
    marketing: true,
    admin: false
  });

  useEffect(() => {
    if (onLogin || status === 'loading') return;

    const r: Role | undefined = hasRole(data?.user)
      ? ((data!.user.role as Role | null) ?? undefined)
      : undefined;

    if (!data?.user || !r) {
      router.replace(`/admin/login?callbackUrl=${encodeURIComponent(safePath)}`);
      return;
    }
    setRole(r);
  }, [onLogin, status, data, router, safePath]);

  const canEditSite = role === 'HEAD' || role === 'STAFF';
  const canManageAdmin = role === 'HEAD'; // keep HEAD-only for sensitive settings
  const canManageMarketing = role === 'HEAD' || role === 'STAFF';

  const groups = useMemo(() => {
    const list: Array<{
      key: GroupKey;
      title: string;
      items: Array<{ href: string; label: string; roles?: Role[] }>;
      hide?: boolean;
    }> = [
      {
        key: 'dashboard',
        title: 'Dashboard',
        items: [{ href: '/admin', label: 'Overview' }]
      },
      {
        key: 'site',
        title: 'Site Editing',
        hide: !canEditSite,
        items: [
          { href: '/admin/site/home', label: 'Home' },
          { href: '/admin/site/about', label: 'About' },
          { href: '/admin/site/faq', label: 'FAQ' },
          { href: '/admin/site/contact', label: 'Contact' }
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
          { href: '/admin/customers', label: 'Customers' },
          { href: '/admin/sales', label: 'Sales' }
        ]
      },
      {
        key: 'marketing',
        title: 'Marketing',
        hide: !canManageMarketing,
        items: [
          // ✅ PROMOTIONS ADMIN PAGE INTEGRATION
          { href: '/admin/promotions', label: 'Promotions' }
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
  if (status === 'loading' || !role) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const toggle = (k: GroupKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className={styles.adminWrapper}>
      <aside className={styles.adminSidebar}>
        {/* Logged in info + bell */}
        {hasRole(data?.user) && data.user.email && (
          <div className={styles.loggedInRow}>
            <div className={styles.loggedIn}>
              Logged in as:
              <br />
              <strong>{data.user.email}</strong>
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
                    className={`${styles.navLink} ${
                      isActivePath(safePath, it.href) ? styles.active : ''
                    }`}
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
