'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/app/login/LoginPage.module.scss';

function safeCallbackUrl(raw?: string | null) {
  // Default to /admin; never allow /admin/login as a target to avoid loops
  if (!raw) return '/admin';
  return raw.startsWith('/admin/login') ? '/admin' : raw;
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sp = useSearchParams();
  const callbackUrl = safeCallbackUrl(sp?.get('callbackUrl'));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await signIn('credentials', {
        email,
        password,
        redirect: true,     // let NextAuth handle the redirect
        callbackUrl,        // safe target (never login)
      });
      // With redirect:true, NextAuth navigates; no need to handle res
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
        <label className={styles.label} htmlFor="email">Email</label>
        <div className={styles.field}>
          <span className={styles.icon} aria-hidden>✉️</span>
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
          <label className={styles.label} htmlFor="password">Password</label>
          <Link href="/forgot-password" className={styles.helper}>Forgot?</Link>
        </div>
        <div className={styles.field}>
          <span className={styles.icon} aria-hidden>🔒</span>
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

      <div className={styles.divider} role="separator"><span>or</span></div>

      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl })}
        className={styles.googleBtn}
      >
        {/* …icon… */}
        Continue with Google
      </button>

      <p className={styles.switchAuth}>
        New here?{" "}
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
