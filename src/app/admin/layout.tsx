'use client';

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
  // 1) All hooks unconditionally
  const pathname = usePathname();
  const safePath = pathname ?? '/admin';
  const onLogin = isLoginPath(safePath);

  const router = useRouter();
  const { status, data } = useSession();

  const [role, setRole] = useState<Role | null>(null);

  const groups = useMemo(
    () => [
      {
        key: 'dashboard' as const,
        title: 'Dashboard',
        kind: 'list' as const,
        items: [{ href: '/admin', label: 'Overview' }]
      },
      {
        key: 'site' as const,
        title: 'Site Editing',
        kind: 'list' as const,
        items: [
          { href: '/admin/site', label: 'Home' },
          { href: '/admin/site/about', label: 'About' },
          { href: '/admin/site/faq', label: 'FAQ' },
          { href: '/admin/site/contact', label: 'Contact' }
        ]
      },
      {
        key: 'products' as const,
        title: 'Products',
        kind: 'chips' as const,
        items: [
          { href: '/admin/products', label: 'All Products' },
          { href: '/admin/products/create', label: 'Add Product' },
          { href: '/admin/products/categories', label: 'Categories' }
        ]
      },
      {
        key: 'operations' as const,
        title: 'Operations',
        kind: 'list' as const,
        items: [
          { href: '/admin/chat', label: 'Chat' },
          { href: '/admin/customers', label: 'Customers' },
          { href: '/admin/sales', label: 'Sales' }
        ]
      },
      {
        key: 'admin' as const,
        title: 'Admin',
        kind: 'list' as const,
        items: [{ href: '/admin/settings', label: 'Settings' }]
      }
    ],
    []
  );

  const activeGroup = useMemo<GroupKey>(() => {
    if (safePath.startsWith('/admin/site')) return 'site';
    if (safePath.startsWith('/admin/products')) return 'products';
    if (
      safePath.startsWith('/admin/chat') ||
      safePath.startsWith('/admin/customers') ||
      safePath.startsWith('/admin/sales')
    )
      return 'operations';
    if (safePath.startsWith('/admin/settings')) return 'admin';
    return 'dashboard';
  }, [safePath]);

  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: false,
    site: true,
    products: false,
    operations: false,
    admin: false
  });

  // 2) Effects declared always; guard inside them

  // Auth gate (skip when on login path)
  useEffect(() => {
    if (onLogin) return;
    if (status === 'loading') return;

    const r: Role | undefined = hasRole(data?.user)
      ? ((data!.user.role as Role | null) ?? undefined)
      : undefined;

    if (!data?.user || !r) {
      const cb = encodeURIComponent(safePath);
      router.replace(`/admin/login?callbackUrl=${cb}`);
      return;
    }
    setRole(r);
  }, [onLogin, status, data, router, safePath]);

  // Restore open-state
  useEffect(() => {
    if (onLogin) return;
    try {
      const raw = localStorage.getItem('pf:admin:navOpen');
      if (raw) setOpen((prev) => ({ ...prev, ...JSON.parse(raw) }));
      else setOpen((prev) => ({ ...prev, [activeGroup]: true }));
    } catch {
      setOpen((prev) => ({ ...prev, [activeGroup]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onLogin]);

  // Persist changes
  useEffect(() => {
    if (onLogin) return;
    try {
      localStorage.setItem('pf:admin:navOpen', JSON.stringify(open));
    } catch {}
  }, [onLogin, open]);

  // 3) After all hooks, short-circuit render on login
  if (onLogin) return <>{children}</>;

  if (status === 'loading' || !role) {
    return <div style={{ padding: '2rem' }}>Loading…</div>;
  }

  const isActive = (href: string) => safePath === href || safePath.startsWith(`${href}/`);
  const toggle = (key: GroupKey) => setOpen((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className={styles.adminWrapper}>
      {role !== 'VIEWER' && <SetupPush />}

      <aside className={styles.adminSidebar}>
        <div className={styles.logo}>👑 Prince Foods</div>

        {hasRole(data?.user) && data.user.email && (
          <div className={styles.loggedIn}>
            Logged in as:
            <br />
            <strong>{data.user.email}</strong>
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

            {open[g.key] &&
              (g.kind === 'chips' ? (
                <div className={styles.pillBar}>
                  {g.items.map((it) => (
                    <Link
                      key={it.href}
                      href={it.href}
                      className={`${styles.pill} ${isActive(it.href) ? styles.pillActive : ''}`}
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              ) : (
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
              ))}
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

      <main className={styles.adminMain}>{children}</main>
    </div>
  );
}
