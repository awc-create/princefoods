'use client';

import styles from '@/app/login/LoginPage.module.scss';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface LoginFormProps {
  /** Pass a pre-normalised callbackUrl from page/client. */
  callbackUrl?: string;
  /** Sentinel error string used by your Credentials authorize() for unverified users. */
  unverifiedErrorCode?: string; // default below
  /** Custom provider ids if you renamed them. */
  googleProviderId?: string;
  credentialsProviderId?: string;
}

export default function LoginForm({
  callbackUrl: propCallback,
  unverifiedErrorCode = 'EmailNotVerified',
  googleProviderId = 'google',
  credentialsProviderId = 'credentials'
}: LoginFormProps) {
  const router = useRouter();
  const sp = useSearchParams();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Fallback to public-safe normalisation only if not provided
  const callbackUrl = propCallback ?? safePublicCallbackUrl(sp?.get('callbackUrl') ?? null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      const res = await signIn(credentialsProviderId, {
        email,
        password,
        redirect: false,
        callbackUrl
      });

      if (!res) {
        setErr('Unexpected error. Try again.');
        setPending(false);
        return;
      }

      if (res.error) {
        // If your authorize() returns/throws a known code for unverified users,
        // route them to /verify; otherwise show generic invalid-credentials.
        if (res.error === unverifiedErrorCode) {
          router.replace(
            `/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(callbackUrl)}`
          );
          router.refresh();
          return;
        }
        setErr('Invalid email or password.');
        setPending(false);
        return;
      }

      // Success: replace so modal closes (if we’re on a modal route)
      router.replace(res.url ?? callbackUrl);
      router.refresh();
    } catch {
      setErr('Unexpected error. Try again.');
      setPending(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.brand}>
        <Image
          src="/assets/prince-foods-logo.png"
          alt="Prince Foods"
          width={140}
          height={74}
          priority
          className={styles.logo}
        />
        <h1 className={styles.title}>Login</h1>
        <p className={styles.subtitle}>Please sign in to continue.</p>
      </div>

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
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className={styles.input}
          />
        </div>

        <div className={styles.rowBetween}>
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <Link href="/forgot-password" className={styles.helper}>
            Forgot?
          </Link>
        </div>

        <div className={styles.field}>
          <span className={styles.icon} aria-hidden>
            🔒
          </span>
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className={styles.input}
          />
          <button
            type="button"
            className={styles.peek}
            onClick={() => setShowPw((s) => !s)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>

        {err && <p className={styles.error}>{err}</p>}

        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className={styles.divider} role="separator">
        <span>or</span>
      </div>

      <button
        type="button"
        onClick={() => signIn(googleProviderId, { callbackUrl })}
        className={styles.googleBtn}
      >
        Continue with Google
      </button>

      <p className={styles.switchAuth}>
        New here?{' '}
        <Link
          href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className={styles.link}
        >
          Sign up now
        </Link>
      </p>
    </div>
  );
}
