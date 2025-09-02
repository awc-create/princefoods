'use client';

import { useState, useTransition, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import styles from '@/app/signup/SignupPage.module.scss';

export default function SignupForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName,  setLastName]  = useState('');
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [phone,     setPhone]     = useState(''); // accept "07..." or "+447..."
  const [err,       setErr]       = useState<string | null>(null);
  const [ok,        setOk]        = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const callbackUrl = sp?.get('callbackUrl') ?? pathname ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            lastName,
            email,
            password,
            phone,
            country: 'GB',
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok || (json && json.ok === false)) {
          setErr(json?.error || 'Could not create account.');
          return;
        }

        // Auto sign in, then bounce back
        const signed = await signIn('credentials', {
          email,
          password,
          redirect: false,
          callbackUrl,
        });

        if (signed?.error) {
          router.push(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
          return;
        }
        router.push(signed?.url || callbackUrl);
      } catch (e: any) {
        setErr(e?.message || 'Unexpected error.');
      }
    });
  }

  return (
    <div className={styles.container}>
      {/* Brand header */}
      <div className={styles.brand}>
        <Image
          src="/assets/prince-foods-logo.png"
          alt="Prince Foods"
          width={140}
          height={74}
          priority
          className={styles.logo}
        />
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join Prince Foods to shop faster and track orders.</p>
      </div>

      <form onSubmit={onSubmit} className={styles.form} autoComplete="on">
        {/* Name row */}
        <div className={styles.grid2}>
          <div>
            <label className={styles.label} htmlFor="firstName">First name</label>
            <div className={styles.field}>
              <span className={styles.icon} aria-hidden>👤</span>
              <input
                id="firstName"
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
                className={styles.input}
              />
            </div>
          </div>

          <div>
            <label className={styles.label} htmlFor="lastName">Last name</label>
            <div className={styles.field}>
              <span className={styles.icon} aria-hidden>👤</span>
              <input
                id="lastName"
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
                className={styles.input}
              />
            </div>
          </div>
        </div>

        {/* Email */}
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

        {/* Password */}
        <label className={styles.label} htmlFor="password">Password</label>
        <div className={styles.field}>
          <span className={styles.icon} aria-hidden>🔒</span>
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
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

        {/* Phone (GB) */}
        <label className={styles.label} htmlFor="phone">Phone (GB +44)</label>
        <div className={styles.field}>
          <span className={styles.badge}>GB +44</span>
          <input
            id="phone"
            type="tel"
            placeholder="+44 7… or 07…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`${styles.input} ${styles.inputWithBadge}`}
            autoComplete="tel"
          />
        </div>

        {err && <p className={styles.error}>{err}</p>}
        {ok && <p className={styles.ok}>{ok}</p>}

        <button type="submit" className={styles.primaryBtn} disabled={pending}>
          {pending ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <div className={styles.divider} role="separator"><span>or</span></div>

      <button
        type="button"
        onClick={() => signIn('google', { callbackUrl })}
        className={styles.googleBtn}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.6 32.5 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.7 3l5.7-5.7C33.5 6.1 28.9 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.4 0 19.1-7.5 19.1-20 0-1.2-.1-2.3-.5-3.5z"/>
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.4 16.5 18.8 14 24 14c3 0 5.7 1.1 7.7 3l5.7-5.7C33.5 6.1 28.9 4 24 4 16.6 4 10.1 8.1 6.3 14.7z"/>
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.8 13.5-4.9l-6.2-5c-2 1.4-4.6 2.3-7.3 2.3-5.3 0-9.7-3.5-11.3-8.3l-6.6 5.1C10.1 39.9 16.6 44 24 44z"/>
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.2 3.5-4.9 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.7 3l5.7-5.7C33.5 6.1 28.9 4 24 4c11.1 0 20 8.9 20 20 0 1.2-.1-2.3-.4-3.5z"/>
        </svg>
        Continue with Google
      </button>

      <p className={styles.switchAuth}>
        Already a member?{' '}
        <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className={styles.link}>
          Log in
        </Link>
      </p>
    </div>
  );
}
