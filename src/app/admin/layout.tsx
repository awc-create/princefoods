// src/app/admin/layout.tsx
'use client';

import NotificationBell from '@/components/admin/NotificationBell';
import '@/styles/Global.scss';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './Admin.module.scss';
import SetupPush from './SetupPush';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type GroupKey = 'dashboard' | 'site' | 'products' | 'operations' | 'admin';

interface UserWithRole {
  email?: string | null;
  role?: Role | null;
}
const hasRole = (u: unknown): u is UserWithRole =>
  !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
const isLoginPath = (p?: string | null) => p === '/admin/login' || p === '/admin/login/';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const safePath = pathname ?? '/admin';
  const onLogin = isLoginPath(safePath);

  const router = useRouter();
  const { status, data } = useSession();
  const [role, setRole] = useState<Role | null>(null);

  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: false,
    site: true,
    products: false,
    operations: false,
    admin: false
  });

  const groups = useMemo(
    () => [
      {
        key: 'dashboard' as const,
        title: 'Dashboard',
        items: [{ href: '/admin', label: 'Overview' }]
      },
      {
        key: 'site' as const,
        title: 'Site Editing',
        items: [
          { href: '/admin/site/home', label: 'Home' },
          { href: '/admin/site/about', label: 'About' },
          { href: '/admin/site/faq', label: 'FAQ' },
          { href: '/admin/site/contact', label: 'Contact' }
        ]
      },
      {
        key: 'products' as const,
        title: 'Products',
        items: [
          { href: '/admin/products', label: 'All Products' },
          { href: '/admin/products/create', label: 'Add Product' },
          { href: '/admin/products/categories', label: 'Categories' },
          { href: '/admin/analytics/products', label: 'Analytics' } // ✅ added
        ]
      },
      {
        key: 'operations' as const,
        title: 'Operations',
        items: [
          { href: '/admin/chat', label: 'Chat' },
          { href: '/admin/customers', label: 'Customers' },
          { href: '/admin/sales', label: 'Sales' }
        ]
      },
      {
        key: 'admin' as const,
        title: 'Admin',
        items: [
          { href: '/admin/notifications', label: 'Notifications' },
          { href: '/admin/settings', label: 'Settings' }
        ]
      }
    ],
    []
  );

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

  if (onLogin) return <>{children}</>;
  if (status === 'loading' || !role) return <div style={{ padding: '2rem' }}>Loading...</div>;

  const isActive = (href: string) => safePath === href || safePath.startsWith(`${href}/`);
  const toggle = (k: GroupKey) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  return (
    <div className={styles.adminWrapper}>
      <aside className={styles.adminSidebar}>
        {/* Logged in info with Bell beside */}
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
                {open[g.key] ? '-' : '+'}
              </span>
            </button>

            {open[g.key] && (
              <nav className={styles.nav}>
                {g.items.map((it) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={`${styles.navLink} ${isActive(it.href) ? styles.active : ''}`}
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
