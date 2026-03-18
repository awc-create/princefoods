'use client';

import styles from '@/app/login/LoginPage.module.scss';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

interface LoginFormProps {
  /** Pass a pre-normalised callbackUrl from page/client. */
  callbackUrl?: string;
  /** Sentinel error string used by your Credentials authorize() for unverified users. */
  unverifiedErrorCode?: string;
  /** Custom provider ids if you renamed them. */
  /** Pass false to hide the Google button when GOOGLE_CLIENT_ID is not configured */
  hasGoogle?: boolean;
  googleProviderId?: string;
  credentialsProviderId?: string;
}

export default function LoginForm({
  callbackUrl: propCallback,
  unverifiedErrorCode = 'EmailNotVerified',
  googleProviderId = 'google',
  credentialsProviderId = 'credentials',
  hasGoogle = true
}: LoginFormProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showMagic, setShowMagic] = useState(false);
  const [magicEmail, setMagicEmail] = useState('');
  const [magicPending, setMagicPending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicErr, setMagicErr] = useState<string | null>(null);

  // Build current full URL (path + query) for callbackUrl default
  const currentFull = useMemo(() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [sp, pathname]);

  const callbackUrl = propCallback ?? safePublicCallbackUrl(sp?.get('callbackUrl') ?? currentFull);

  // --- Close modal helper: drop ?modal and drop callbackUrl if it's just "/" ---
  function closeModal() {
    const params = new URLSearchParams(window.location.search);
    params.delete('modal');

    const cb = params.get('callbackUrl');
    if (!cb || cb === '/' || cb === decodeURIComponent('%2F')) {
      params.delete('callbackUrl');
    }

    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url);
    router.refresh();
  }

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

      // Success: replace so any modal closes
      router.replace(res.url ?? callbackUrl);
      router.refresh();
    } catch {
      setErr('Unexpected error. Try again.');
      setPending(false);
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMagicErr(null);
    setMagicPending(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicEmail, next: callbackUrl })
      });
      const _data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setMagicErr('Too many attempts. Please try again later.');
        return;
      }
      // Always show success (avoid enumeration)
      setMagicSent(true);
    } catch {
      setMagicErr('Could not send link. Try again.');
    } finally {
      setMagicPending(false);
    }
  }

  // For the switch link, keep existing params but flip to modal=signup
  const qsObj = Object.fromEntries(sp ?? []);
  const switchHref = {
    pathname,
    query: {
      ...qsObj,
      modal: 'signup',
      ...(callbackUrl && callbackUrl !== '/' ? { callbackUrl } : {})
    }
  } as const;

  return (
    <div className={styles.container}>
      {/* Close button */}
      <button
        type="button"
        onClick={closeModal}
        className={styles.closeBtn ?? 'closeBtn'}
        aria-label="Close modal"
        title="Close"
      >
        ✕
      </button>

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
          <button
            type="button"
            className={styles.helper}
            onClick={() => {
              setShowMagic(true);
              setMagicEmail(email);
            }}
          >
            Forgot / sign in by email link
          </button>
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

      {hasGoogle && (
        <button
          type="button"
          onClick={() => signIn(googleProviderId, { callbackUrl })}
          className={styles.googleBtn}
        >
          Continue with Google
        </button>
      )}

      <p className={styles.switchAuth}>
        New here?{' '}
        <Link href={switchHref} replace className={styles.link}>
          Sign up now
        </Link>
      </p>

      {showMagic && (
        <div className={styles.magicOverlay}>
          <div className={styles.magicBox}>
            <h3 className={styles.magicTitle}>Sign in with a link</h3>
            <p className={styles.magicSub}>
              We&apos;ll email you a one-click sign-in link — no password needed.
            </p>
            {magicSent ? (
              <p className={styles.ok}>✅ Check your inbox — a sign-in link is on its way.</p>
            ) : (
              <form onSubmit={sendMagicLink} className={styles.form}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className={styles.input}
                />
                {magicErr && <p className={styles.error}>{magicErr}</p>}
                <button type="submit" className={styles.primaryBtn} disabled={magicPending}>
                  {magicPending ? 'Sending…' : 'Send sign-in link'}
                </button>
              </form>
            )}
            <button
              type="button"
              className={styles.helper}
              onClick={() => {
                setShowMagic(false);
                setMagicSent(false);
              }}
            >
              ← Back to password login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
