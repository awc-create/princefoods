'use client';
// src/app/admin/(protected)/ProtectedAdminShell.tsx
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import styles from '../Admin.module.scss';
import SetupPush from '../SetupPush';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
type GroupKey = 'dashboard' | 'products' | 'operations' | 'admin';

interface UserWithRole {
  email?: string | null;
  role?: Role | null;
}

function hasRole(u: unknown): u is UserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export default function ProtectedAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin';
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
        key: 'products' as const,
        title: 'Products',
        kind: 'chips' as const,
        items: [{ href: '/admin/(protected)/products', label: 'All Products' }]
      },
      { key: 'operations' as const, title: 'Operations', kind: 'list' as const, items: [] },
      {
        key: 'admin' as const,
        title: 'Admin',
        kind: 'list' as const,
        items: [{ href: '/admin/(protected)/settings', label: 'Settings' }]
      }
    ],
    []
  );

  const activeGroup = useMemo<GroupKey>(() => {
    if (pathname.includes('/products')) return 'products';
    if (pathname.includes('/settings')) return 'admin';
    return 'dashboard';
  }, [pathname]);

  const [open, setOpen] = useState<Record<GroupKey, boolean>>({
    dashboard: false,
    products: false,
    operations: false,
    admin: false
  });

  useEffect(() => {
    if (status === 'loading') return;
    const r: Role | undefined = hasRole(data?.user)
      ? ((data!.user.role as Role | null) ?? undefined)
      : undefined;
    if (!data?.user || !r) {
      const cb = encodeURIComponent('/admin');
      router.replace(`/admin/login?callbackUrl=${cb}`);
      return;
    }
    setRole(r);
  }, [status, data, router]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('pf:admin:navOpen');
      if (raw) setOpen((p) => ({ ...p, ...JSON.parse(raw) }));
      else setOpen((p) => ({ ...p, [activeGroup]: true }));
    } catch {
      setOpen((p) => ({ ...p, [activeGroup]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pf:admin:navOpen', JSON.stringify(open));
    } catch {}
  }, [open]);

  if (status === 'loading' || !role) return <div style={{ padding: '2rem' }}>Loading…</div>;

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
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
