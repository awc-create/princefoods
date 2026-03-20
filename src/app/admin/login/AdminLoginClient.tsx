'use client';

import { getSession, signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import styles from './Login.module.scss';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

function safeAdminCallbackUrl(raw?: string | null) {
  if (!raw) return '/admin';
  return raw.startsWith('/admin/login') ? '/admin' : raw;
}

function isStaff(role?: unknown): role is 'HEAD' | 'STAFF' {
  return role === 'HEAD' || role === 'STAFF';
}

export default function AdminLoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const { data, status } = useSession();
  const sp = useSearchParams();
  const router = useRouter();

  const rawCb = sp?.get('callbackUrl') ?? null;

  const callbackUrl = useMemo(() => {
    if (!rawCb) return '/admin';
    try {
      return safeAdminCallbackUrl(decodeURIComponent(rawCb));
    } catch {
      return safeAdminCallbackUrl(rawCb);
    }
  }, [rawCb]);

  // Clean bad callback in address bar
  useEffect(() => {
    if (!rawCb) return;
    try {
      const target = decodeURIComponent(rawCb);
      if (target.startsWith('/admin/login')) {
        const clean = window.location.pathname; // keep /admin/login
        window.history.replaceState({}, '', clean);
      }
    } catch {
      /* ignore */
    }
  }, [rawCb]);

  // Already authenticated as staff → dashboard. Non-staff authenticated users stay on login.
  useEffect(() => {
    if (status === 'authenticated') {
      const role = (data?.user as { role?: string } | undefined)?.role;
      if (role === 'HEAD' || role === 'STAFF') {
        router.replace(callbackUrl);
        router.refresh();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, callbackUrl, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);

    try {
      console.log('[ADMIN LOGIN] submitting', { email: email.trim(), callbackUrl });

      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl
      });

      console.log('[ADMIN LOGIN] signIn result', res);

      if (!res) {
        setErr('Unexpected error. Try again.');
        return;
      }

      if (res.error) {
        setErr('Invalid email or password.');
        return;
      }

      // ✅ proves whether cookie/session actually exists
      const session = await getSession();
      console.log('[ADMIN LOGIN] session after signIn', session);

      const role = (session?.user as { role?: Role } | undefined)?.role;

      if (!isStaff(role)) {
        await signOut({ redirect: false });
        setErr('Access denied. Staff accounts only.');
        return;
      }

      const target = res.url ?? callbackUrl;
      console.log('[ADMIN LOGIN] redirecting to', target);

      // ✅ most reliable across subdomain/dev setups
      window.location.assign(target);
    } catch (e) {
      console.error('[ADMIN LOGIN] failed', e);
      setErr('Unexpected error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className={styles.screen}>
        <div className={styles.loader} aria-label="Checking session" />
      </div>
    );
  }

  return (
    <main className={styles.screen}>
      <div className={styles.card} role="form" aria-labelledby="admin-login-title">
        <div className={styles.brand}>
          <Image
            src="/assets/prince-foods-logo.png"
            alt="Prince Foods"
            width={120}
            height={64}
            priority
            className={styles.logo}
          />
          <h1 id="admin-login-title" className={styles.title}>
            Admin Login
          </h1>
          <p className={styles.subtitle}>Staff access only</p>
        </div>

        {err && (
          <div className={styles.error} role="alert">
            {err}
          </div>
        )}

        <form onSubmit={onSubmit} className={styles.form} autoComplete="on">
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <div className={styles.field}>
            <span className={styles.icon} aria-hidden>
              ✉️
            </span>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="admin@prince-v.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className={styles.input}
              disabled={pending}
            />
          </div>

          <div className={styles.rowBetween}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setShowPw((s) => !s)}
              aria-pressed={showPw}
            >
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className={styles.field}>
            <span className={styles.icon} aria-hidden>
              🔒
            </span>
            <input
              id="password"
              name="password"
              type={showPw ? 'text' : 'password'}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={styles.input}
              disabled={pending}
            />
          </div>

          <button type="submit" className={styles.primaryBtn} disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.meta}>
          By signing in you agree to our{' '}
          <a href="/terms-of-service" className={styles.metaLink}>
            Terms
          </a>{' '}
          &amp;{' '}
          <a href="/privacy-policy" className={styles.metaLink}>
            Privacy
          </a>
          .
        </p>
      </div>
    </main>
  );
}
