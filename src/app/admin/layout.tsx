// src/app/admin/layout.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './Admin.module.scss';
import SetupPush from './SetupPush';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type GroupKey = 'dashboard' | 'products' | 'operations' | 'admin';

type UserWithRole = {
  email?: string | null;
  role?: Role | null;
};

// Type guard to avoid `any`
function hasRole(u: unknown): u is UserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const safePath = pathname ?? '/admin';
  const router = useRouter();
  const { status, data } = useSession();

  const [role, setRole] = useState<Role | null>(null);

  // All groups + items
  const groups = useMemo(
    () =>
      [
        {
          key: 'dashboard' as const,
          title: 'Dashboard',
          kind: 'list' as const,
          items: [{ href: '/admin', label: 'Overview' }],
        },
        {
          key: 'products' as const,
          title: 'Products',
          kind: 'chips' as const, // render as "pills"
          items: [
            { href: '/admin/products', label: 'All Products' },
            { href: '/admin/products/create', label: 'Add Product' },
            { href: '/admin/products/categories', label: 'Categories' },
          ],
        },
        {
          key: 'operations' as const,
          title: 'Operations',
          kind: 'list' as const,
          items: [
            { href: '/admin/chat', label: 'Chat' },
            { href: '/admin/customers', label: 'Customers' },
            { href: '/admin/sales', label: 'Sales' },
          ],
        },
        {
          key: 'admin' as const,
          title: 'Admin',
          kind: 'list' as const,
          items: [{ href: '/admin/settings', label: 'Settings' }],
        },
      ],
    []
  );

  // Which group matches current route (used for default open on first mount)
  const activeGroup = useMemo<GroupKey>(() => {
    if (safePath.startsWith('/admin/products')) return 'products';
    if (
      safePath.startsWith('/admin/chat') ||
      safePath.startsWith('/admin/customers') ||
      safePath.startsWith('/admin/sales')
    ) {
      return 'operations';
    }
    if (safePath.startsWith('/admin/settings')) return 'admin';
    return 'dashboard';
  }, [safePath]);

  // Collapsible state (persisted)
  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: false,
    products: false,
    operations: false,
    admin: false,
  });

  // Auth gate
  useEffect(() => {
    if (status === 'loading') return;

    const r: Role | undefined = hasRole(data?.user) ? (data!.user.role as Role | null) ?? undefined : undefined;

    if (!data?.user || !r) {
      const cb = encodeURIComponent(safePath);
      router.replace(`/admin/login?callbackUrl=${cb}`);
      return;
    }
    setRole(r);
  }, [status, data, router, safePath]);

  // Restore open-state or default-open to group that matches URL
  useEffect(() => {
    try {
      const raw = localStorage.getItem('pf:admin:navOpen');
      if (raw) {
        setOpen((prev) => ({ ...prev, ...JSON.parse(raw) }));
      } else {
        setOpen((prev) => ({ ...prev, [activeGroup]: true }));
      }
    } catch {
      setOpen((prev) => ({ ...prev, [activeGroup]: true }));
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist changes
  useEffect(() => {
    try {
      localStorage.setItem('pf:admin:navOpen', JSON.stringify(open));
    } catch {
      // ignore write errors (private mode, etc.)
    }
  }, [open]);

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
            Logged in as:<br />
            <strong>{data.user.email}</strong>
          </div>
        )}

        {/* Render all groups. Title row itself is clickable */}
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

        {/* Logout */}
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
