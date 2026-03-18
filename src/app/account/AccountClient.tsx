'use client';

import { useCart } from '@/lib/cart-store';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import styles from './TabsAccount.module.scss';

import AddressesTab from '@/components/account/tabs/addresses/AddressesTab';
import OrdersTab from '@/components/account/tabs/orders/OrdersTab';

type Tab = 'overview' | 'profile' | 'orders' | 'addresses' | 'security';

const ALL_TABS: Tab[] = ['overview', 'profile', 'orders', 'addresses', 'security'];

// Fix 4: human-friendly status labels

// Fix 6: E.164 phone normalisation
function normalisePhone(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  // Already E.164
  if (/^\+\d{7,15}$/.test(t)) return t;
  // UK 07xxx → +447xxx
  const digits = t.replace(/\D/g, '');
  if (digits.startsWith('07') && digits.length === 11) return '+44' + digits.slice(1);
  if (digits.startsWith('447') && digits.length === 12) return '+' + digits;
  // Anything that looks like a full international number
  if (digits.length >= 7 && digits.length <= 15) return '+' + digits;
  return t; // return as-is, validation will catch it
}

function isValidPhone(v: string): boolean {
  if (!v) return true; // optional
  return /^\+\d{7,15}$/.test(v);
}

interface UserDTO {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneE164: string | null;
  // Fix 8: boolean, not raw timestamp
  isVerified: boolean;
  createdAt: string | Date;
}

export default function AccountClient({
  user,
  initialTab = 'overview'
}: {
  user: UserDTO;
  initialTab?: Tab;
}) {
  const cart = useCart();
  const cartCount = useMemo(() => {
    const items = (cart as unknown as { items?: unknown[] })?.items;
    return Array.isArray(items) ? items.length : 0;
  }, [cart]);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [saving, startSaving] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [profile, setProfile] = useState({
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    name: user.name ?? '',
    phoneE164: user.phoneE164 ?? '',
    email: user.email ?? ''
  });

  const emailChanged = profile.email.trim().toLowerCase() !== user.email.toLowerCase();
  const verified = user.isVerified && !emailChanged;

  function gotoTab(next: Tab) {
    setTab(next);

    const params = new URLSearchParams(window.location.search);
    params.set('tab', next);

    const qs = params.toString();
    const path = `${window.location.pathname}${qs ? `?${qs}` : ''}`;

    window.history.pushState({}, '', path);
  }

  // ✅ Read tab from URL on mount + handle back/forward
  useEffect(() => {
    const read = () => {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab') as Tab | null;
      if (t && ALL_TABS.includes(t)) setTab(t);
    };

    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);

  function onChange<K extends keyof typeof profile>(key: K, v: string) {
    setProfile((p) => ({ ...p, [key]: v }));
  }

  function saveProfile() {
    setMsg(null);
    setErr(null);

    // Validate email
    const newEmail = profile.email.trim();
    if (!newEmail || !/^\S+@\S+\.\S+$/.test(newEmail)) {
      setErr('Please enter a valid email address.');
      return;
    }
    if (profile.phoneE164 && !isValidPhone(normalisePhone(profile.phoneE164))) {
      setErr('Please enter a valid phone number.');
      return;
    }

    startSaving(async () => {
      try {
        const res = await fetch('/api/account/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; emailChanged?: boolean };
        if (!data.ok) {
          setErr(data.error ?? 'Could not update profile');
          return;
        }

        // If email changed, trigger verification to new address
        if (data.emailChanged) {
          await fetch('/api/auth/send-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: newEmail, next: '/account?tab=profile' })
          });
          setMsg(
            `Profile updated. A verification email has been sent to ${newEmail} — please check your inbox.`
          );
        } else {
          setMsg('Profile updated.');
        }
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
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) setMsg('If your email started verification, a new code/link is on the way.');
      else setErr(data.error ?? 'Could not send verification');
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
          type="button"
        >
          Sign out
        </button>
      </header>

      {/* Tabs */}
      <nav className={styles.tabs} role="tablist" aria-label="Account sections">
        {ALL_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`${styles.tab} ${tab === t ? styles.active : ''}`}
            onClick={() => gotoTab(t)}
            type="button"
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>

      {/* Panels */}
      <section className={styles.panel}>
        {/* ✅ OVERVIEW */}
        {tab === 'overview' && (
          <div className={styles.cards}>
            {!verified && (
              <div className={`${styles.card} ${styles.fullRow}`}>
                <h3 className={styles.cardTitle}>Verify your email</h3>
                <p className={styles.muted}>Verify to secure your account and enable checkout.</p>
                <div className={styles.rowBtns}>
                  <Link
                    className={`${styles.btn} ${styles.btnLine}`}
                    href={`/verify?email=${encodeURIComponent(
                      user.email
                    )}&next=/account?tab=overview`}
                  >
                    Enter code
                  </Link>
                  <button
                    className={`${styles.btn} ${styles.btnPrimaryAlt}`}
                    onClick={resendVerify}
                    type="button"
                  >
                    Send new code
                  </button>
                </div>
              </div>
            )}

            {/* Card buttons that switch tabs */}
            <button type="button" className={styles.cardBtn} onClick={() => gotoTab('orders')}>
              <div className={`${styles.card} ${styles.cardBtnInner}`}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardTitle}>Orders</h3>
                  <span className={styles.chev}>→</span>
                </div>
                <p className={styles.muted}>View your past orders and receipts.</p>
                <div className={styles.rowBtns}>
                  <span className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>
                    View orders
                  </span>
                </div>
              </div>
            </button>

            <button type="button" className={styles.cardBtn} onClick={() => gotoTab('addresses')}>
              <div className={`${styles.card} ${styles.cardBtnInner}`}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardTitle}>Addresses</h3>
                  <span className={styles.chev}>→</span>
                </div>
                <p className={styles.muted}>Manage shipping and billing addresses.</p>
                <div className={styles.rowBtns}>
                  <span className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>Manage</span>
                </div>
              </div>
            </button>

            <button type="button" className={styles.cardBtn} onClick={() => gotoTab('security')}>
              <div className={`${styles.card} ${styles.cardBtnInner}`}>
                <div className={styles.cardTop}>
                  <h3 className={styles.cardTitle}>Security</h3>
                  <span className={styles.chev}>→</span>
                </div>
                <p className={styles.muted}>Email verification and password.</p>
                <div className={styles.rowBtns}>
                  <span className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>Open</span>
                </div>
              </div>
            </button>

            {/* Quick actions */}
            <div className={`${styles.card} ${styles.fullRow}`}>
              <h3 className={styles.cardTitle}>Quick actions</h3>
              <p className={styles.muted}>Jump back into shopping or checkout.</p>

              <div className={styles.rowBtns}>
                {cartCount > 0 ? (
                  <Link className={`${styles.btn} ${styles.btnPrimary}`} href="/checkout">
                    Continue checkout ({cartCount})
                  </Link>
                ) : (
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary} ${styles.btnDisabled}`}
                    disabled
                    aria-disabled="true"
                    title="Add items to your cart to checkout"
                  >
                    Continue checkout
                  </button>
                )}

                <Link className={`${styles.btn} ${styles.btnGhost}`} href="/cart">
                  View cart
                </Link>

                <Link className={`${styles.btn} ${styles.btnGhost}`} href="/shop">
                  Browse shop
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE */}
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
              <label>Email address</label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => onChange('email', e.target.value)}
                autoComplete="email"
              />
              {emailChanged && (
                <p className={styles.fieldWarn}>
                  ⚠️ Changing your email will require re-verification. A code will be sent to the
                  new address.
                </p>
              )}
            </div>

            <div className={styles.formRow}>
              <label>Phone</label>
              <input
                placeholder="+44 7700 900000"
                value={profile.phoneE164}
                onChange={(e) => onChange('phoneE164', e.target.value)}
                onBlur={(e) => {
                  const normalised = normalisePhone(e.target.value);
                  onChange('phoneE164', normalised);
                }}
                type="tel"
              />
              {profile.phoneE164 && !isValidPhone(profile.phoneE164) && (
                <p className={styles.fieldErr}>
                  Enter a valid phone number (e.g. +44 7700 900000 or 07700 900000)
                </p>
              )}
            </div>

            {err && <p className={styles.error}>{err}</p>}
            {msg && <p className={styles.ok}>{msg}</p>}

            <div className={styles.actionsRow}>
              <button
                disabled={saving}
                onClick={saveProfile}
                className={`${styles.btn} ${styles.btnPrimary}`}
                type="button"
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>

              <button
                onClick={() =>
                  setProfile({
                    firstName: user.firstName ?? '',
                    lastName: user.lastName ?? '',
                    name: user.name ?? '',
                    phoneE164: user.phoneE164 ?? '',
                    email: user.email ?? ''
                  })
                }
                className={`${styles.btn} ${styles.btnGhost}`}
                type="button"
              >
                Discard
              </button>
            </div>
          </>
        )}

        {/* ORDERS */}
        {tab === 'orders' && <OrdersTab />}

        {/* ADDRESSES */}
        {tab === 'addresses' && <AddressesTab />}

        {/* SECURITY */}
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
                <button
                  className={`${styles.btn} ${styles.btnPrimaryAlt}`}
                  onClick={resendVerify}
                  type="button"
                >
                  Resend verification
                </button>
              </div>
            )}

            {/* Fix 2: magic-link sign-in is the password reset for this app */}
            <p className={styles.muted} style={{ marginTop: 16 }}>
              This account uses passwordless sign-in. To change your email address or access, please{' '}
              <Link href={`/verify?email=${encodeURIComponent(user.email)}&next=/account`}>
                request a new sign-in code
              </Link>{' '}
              or contact <a href="mailto:support@prince-foods.com">support@prince-foods.com</a>.
            </p>
          </>
        )}
      </section>
    </>
  );
}
