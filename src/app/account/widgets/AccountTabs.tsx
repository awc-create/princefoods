'use client';

import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import styles from '../TabsAccount.module.scss';

interface U {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
  emailVerified: string | null;
  createdAt: string | Date;
}

const TABS = ['overview', 'profile', 'orders', 'addresses', 'wallet', 'security'] as const;
type Tab = (typeof TABS)[number];

export default function AccountTabs({ user }: { user: U }) {
  // initial tab from query
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const sp = new URLSearchParams(window.location.search);
    return (sp.get('tab') as Tab) || 'overview';
  });

  // sync URL ?tab= — guard-safe (no new URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState({}, '', path);
  }, [tab]);

  const verified = !!user.emailVerified;

  async function resendVerify() {
    await fetch('/api/auth/send-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, resend: true, next: '/account?tab=security' })
    });
    alert('If your email already started verification, a new code/link is on the way.');
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className={styles.title}>{user.name ?? user.email}</h1>
              <p className={styles.sub}>
                Member since {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button className={styles.btnGhost} onClick={() => signOut({ callbackUrl: '/' })}>
            Sign out
          </button>
        </header>

        {/* Tabs */}
        <nav className={styles.tabs} role="tablist" aria-label="Account sections">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              className={`${styles.tab} ${tab === t ? styles.active : ''}`}
              onClick={() => setTab(t)}
            >
              {labelFor(t)}
            </button>
          ))}
        </nav>

        {/* Panels */}
        <section
          id="panel-overview"
          role="tabpanel"
          hidden={tab !== 'overview'}
          className={styles.panel}
        >
          {!verified && (
            <div className={styles.banner}>
              <div>
                <strong>Email not verified.</strong> Verify to secure your account and enable
                checkout.
              </div>
              <div className={styles.bannerActions}>
                <Link
                  className={styles.btnLine}
                  href={`/verify?email=${encodeURIComponent(user.email)}&next=/account?tab=overview`}
                >
                  Enter code
                </Link>
                <button onClick={resendVerify} className={styles.btnPrimaryAlt}>
                  Send new code
                </button>
              </div>
            </div>
          )}

          <div className={styles.cards}>
            <div className={styles.card}>
              <h3>Orders</h3>
              <p className={styles.muted}>Your latest orders will appear here.</p>
              <Link className={styles.btnGhost} href="/orders">
                View all
              </Link>
            </div>
            <div className={styles.card}>
              <h3>Addresses</h3>
              <p className={styles.muted}>Add delivery and billing addresses.</p>
              <button className={styles.btnGhost} disabled>
                + Add address
              </button>
            </div>
            <div className={styles.card}>
              <h3>Wallet</h3>
              <p className={styles.muted}>Saved cards & credit.</p>
              <button className={styles.btnGhost} disabled>
                Manage wallet
              </button>
            </div>
          </div>
        </section>

        <section
          id="panel-profile"
          role="tabpanel"
          hidden={tab !== 'profile'}
          className={styles.panel}
        >
          <h2 className={styles.h2}>Profile</h2>
          <div className={styles.formRow}>
            <label>First name</label>
            <input defaultValue={user.firstName ?? ''} />
          </div>
          <div className={styles.formRow}>
            <label>Last name</label>
            <input defaultValue={user.lastName ?? ''} />
          </div>
          <div className={styles.formRow}>
            <label>Display name</label>
            <input defaultValue={user.name ?? ''} />
          </div>
          <div className={styles.formRow}>
            <label>Phone</label>
            <input placeholder="+44…" defaultValue={user.phoneE164 ?? ''} />
          </div>
          <div className={styles.actionsRow}>
            <button className={styles.btnPrimary}>Save changes</button>
            <button className={styles.btnGhost}>Discard</button>
          </div>
        </section>

        <section
          id="panel-orders"
          role="tabpanel"
          hidden={tab !== 'orders'}
          className={styles.panel}
        >
          <h2 className={styles.h2}>Orders</h2>
          <p className={styles.muted}>No orders yet.</p>
        </section>

        <section
          id="panel-addresses"
          role="tabpanel"
          hidden={tab !== 'addresses'}
          className={styles.panel}
        >
          <h2 className={styles.h2}>Addresses</h2>
          <p className={styles.muted}>Manage your shipping and billing addresses.</p>
          <button className={styles.btnGhost} disabled>
            + Add address
          </button>
        </section>

        <section
          id="panel-wallet"
          role="tabpanel"
          hidden={tab !== 'wallet'}
          className={styles.panel}
        >
          <h2 className={styles.h2}>Wallet</h2>
          <p className={styles.muted}>Save a card for faster checkout. (Coming soon)</p>
        </section>

        <section
          id="panel-security"
          role="tabpanel"
          hidden={tab !== 'security'}
          className={styles.panel}
        >
          <h2 className={styles.h2}>Security</h2>
          <div className={styles.kv}>
            <span>Email</span>
            <span>
              {user.email} {verified ? '✅' : '(unverified)'}
            </span>
          </div>
          {!verified && (
            <div className={styles.rowBtns}>
              <Link
                className={styles.btnLine}
                href={`/verify?email=${encodeURIComponent(user.email)}&next=/account?tab=security`}
              >
                Enter code
              </Link>
              <button onClick={resendVerify} className={styles.btnPrimaryAlt}>
                Resend verification
              </button>
            </div>
          )}
          <div className={styles.rowBtns}>
            <Link className={styles.btnGhost} href="/reset-password">
              Change password
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function labelFor(t: Tab) {
  switch (t) {
    case 'overview':
      return 'Overview';
    case 'profile':
      return 'Profile';
    case 'orders':
      return 'Orders';
    case 'addresses':
      return 'Addresses';
    case 'wallet':
      return 'Wallet';
    case 'security':
      return 'Security';
  }
}
