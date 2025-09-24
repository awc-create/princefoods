'use client';

import { penceToGBP } from '@/lib/money';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import styles from './TabsAccount.module.scss';

type Tab = 'overview' | 'profile' | 'orders' | 'addresses' | 'wallet' | 'security';

interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
  emailVerified: string | null;
  createdAt: string | Date;
}

interface OrderBrief {
  id: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  createdAt: string;
  items: { id: string; name: string; quantity: number; imageUrl?: string | null }[];
}

export default function AccountClient({ user }: { user: UserDTO }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [saving, startSaving] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Editable profile state (from the REAL user)
  const [profile, setProfile] = useState({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    name: user.name ?? '',
    phoneE164: user.phoneE164 ?? ''
  });

  // Orders
  const [orders, setOrders] = useState<OrderBrief[] | null>(null);

  // URL sync — guard-safe (no new URL)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const t = sp.get('tab') as Tab | null;
    if (t) setTab(t);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
    window.history.replaceState({}, '', path);
  }, [tab]);

  // Fetch orders when entering the tab (once)
  useEffect(() => {
    if (tab !== 'orders' || orders !== null) return;
    (async () => {
      try {
        const res = await fetch('/api/account/orders', { cache: 'no-store' });
        const json = await res.json();
        setOrders(json.orders ?? []);
      } catch {
        setOrders([]);
      }
    })();
  }, [tab, orders]);

  const verified = !!user.emailVerified;

  function onChange<K extends keyof typeof profile>(key: K, v: string) {
    setProfile((p) => ({ ...p, [key]: v }));
  }

  function saveProfile() {
    setMsg(null);
    setErr(null);
    startSaving(async () => {
      try {
        const res = await fetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
        const data = await res.json();
        if (data.ok) setMsg('Profile updated');
        else setErr(data.error ?? 'Could not update profile');
      } catch {
        setErr('Could not update profile');
      }
    });
  }

  async function resendVerify() {
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch('/api/auth/send-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, resend: true, next: '/account?tab=security' })
      });
      const data = await res.json();
      if (data.ok) {
        setMsg('If your email started verification, a new code/link is on the way.');
      } else {
        setErr(data.error ?? 'Could not send verification');
      }
    } catch {
      setErr('Could not send verification');
    }
  }

  return (
    <>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.avatarWrap}>
            <div className={styles.avatar}>
              {(user.name ?? user.email).slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div>
            <h1 className={styles.title}>{user.name ?? user.email}</h1>
            <p className={styles.sub}>
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <button
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          Sign out
        </button>
      </header>

      {/* Tabs */}
      <nav className={styles.tabs} role="tablist" aria-label="Account sections">
        {(['overview', 'profile', 'orders', 'addresses', 'wallet', 'security'] as Tab[]).map(
          (t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${styles.tab} ${tab === t ? styles.active : ''}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          )
        )}
      </nav>

      {/* Panels */}
      <section className={styles.panel}>
        {tab === 'overview' && (
          <div className={styles.cards}>
            {!verified && (
              <div className={styles.card} style={{ gridColumn: '1 / -1' }}>
                <h3 className={styles.cardTitle}>Verify your email</h3>
                <p className={styles.muted}>Verify to secure your account and enable checkout.</p>
                <div className={styles.rowBtns}>
                  <Link
                    className={`${styles.btn} ${styles.btnLine}`}
                    href={`/verify?email=${encodeURIComponent(user.email)}&next=/account?tab=overview`}
                  >
                    Enter code
                  </Link>
                  <button
                    className={`${styles.btn} ${styles.btnPrimaryAlt}`}
                    onClick={resendVerify}
                  >
                    Send new code
                  </button>
                </div>
              </div>
            )}
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Orders</h3>
              <p className={styles.muted}>No orders yet.</p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Addresses</h3>
              <p className={styles.muted}>Manage your shipping and billing addresses.</p>
            </div>
            <div className={styles.card}>
              <h3 className={styles.cardTitle}>Wallet</h3>
              <p className={styles.muted}>Saved cards & credit.</p>
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <>
            <h2 className={styles.h2}>Profile</h2>
            <div className={styles.formRow}>
              <label>First name</label>
              <input
                value={profile.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label>Last name</label>
              <input
                value={profile.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label>Display name</label>
              <input value={profile.name} onChange={(e) => onChange('name', e.target.value)} />
            </div>
            <div className={styles.formRow}>
              <label>Phone</label>
              <input
                placeholder="+44…"
                value={profile.phoneE164}
                onChange={(e) => onChange('phoneE164', e.target.value)}
              />
            </div>

            {err && <p className={styles.error}>{err}</p>}
            {msg && <p className={styles.ok}>{msg}</p>}

            <div className={styles.actionsRow}>
              <button
                disabled={saving}
                onClick={saveProfile}
                className={`${styles.btn} ${styles.btnPrimary}`}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={() =>
                  setProfile({
                    firstName: user.firstName ?? '',
                    lastName: user.lastName ?? '',
                    name: user.name ?? '',
                    phoneE164: user.phoneE164 ?? ''
                  })
                }
                className={`${styles.btn} ${styles.btnGhost}`}
              >
                Discard
              </button>
            </div>
          </>
        )}

        {tab === 'orders' && (
          <div className={styles.ordersList}>
            {orders === null && <p className={styles.muted}>Loading your orders…</p>}
            {orders?.length === 0 && <p className={styles.muted}>No orders yet.</p>}
            {orders?.length ? (
              <ul className={styles.orderUl}>
                {orders.map((o) => (
                  <li key={o.id} className={styles.orderLi}>
                    <Link href={`/account/orders/${o.id}`} className={styles.orderCard}>
                      <div className={styles.orderTop}>
                        <span className={styles.orderId}>#{o.id.slice(0, 8)}</span>
                        <span className={styles.orderDate}>
                          {new Date(o.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className={styles.orderMid}>
                        <span className={styles.badge}>{o.status}</span>
                        <span className={styles.badgeMuted}>{o.paymentStatus}</span>
                        <span className={styles.total}>{penceToGBP(o.grandTotal)}</span>
                      </div>
                      <div className={styles.orderItems}>
                        {o.items.slice(0, 3).map((it) => (
                          <span key={it.id} className={styles.itemDot}>
                            {it.quantity}× {it.name}
                          </span>
                        ))}
                        {o.items.length > 3 && (
                          <span className={styles.itemDot}>+{o.items.length - 3} more</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {tab === 'addresses' && <p className={styles.muted}>Addresses form here…</p>}
        {tab === 'wallet' && <p className={styles.muted}>Wallet settings here…</p>}
        {tab === 'security' && (
          <>
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
                  className={`${styles.btn} ${styles.btnLine}`}
                  href={`/verify?email=${encodeURIComponent(user.email)}&next=/account?tab=security`}
                >
                  Enter code
                </Link>
                <button className={`${styles.btn} ${styles.btnPrimaryAlt}`} onClick={resendVerify}>
                  Resend verification
                </button>
              </div>
            )}
            <div className={styles.rowBtns}>
              <Link className={`${styles.btn} ${styles.btnGhost}`} href="/reset-password">
                Change password
              </Link>
            </div>
          </>
        )}
      </section>
    </>
  );
}
