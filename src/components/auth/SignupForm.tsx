'use client';

import styles from '@/app/signup/SignupPage.module.scss';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useMemo, useState, useTransition } from 'react';

// Fix 6: password strength validation
function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain at least one letter.';
  if (!/[0-9!@#$%^&*]/.test(pw)) return 'Password must contain a number or special character.';
  return null;
}

// Fix 3: detect country from browser locale
function detectCountry(): string {
  if (typeof navigator === 'undefined') return 'GB';
  const lang = navigator.language ?? 'en-GB';
  // Common locale → country mappings for Prince Foods markets
  if (lang.includes('IE') || lang === 'en-IE') return 'IE';
  if (lang.includes('US') || lang === 'en-US') return 'US';
  if (lang.includes('AU') || lang === 'en-AU') return 'AU';
  // Default to GB for all other en-* and unknown locales
  return 'GB';
}

export default function SignupForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname() ?? '/';

  // Current full URL (path + query) for callback defaults
  const currentFull = useMemo(() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [sp, pathname]);

  const callbackUrl = sp?.get('callbackUrl') ?? currentFull;

  // --- Close modal helper (same behaviour as Login) ---
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);

    // Fix 6: client-side password strength check
    const pwErr = validatePassword(password);
    if (pwErr) {
      setErr(pwErr);
      return;
    }

    // Fix 3: detect country from browser
    const country = detectCountry();
    setOk(null);

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
            country
          })
        });

        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || json.ok === false) {
          setErr(json?.error ?? 'Could not create account.');
          return;
        }

        // Always go to verify page (replace to clear modal stack)
        const params = new URLSearchParams();
        params.set('email', email);
        params.set('next', sp?.get('next') ?? '/'); // after verify, home or /account

        router.replace(`/verify?${params.toString()}`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unexpected error.';
        setErr(msg);
      }
    });
  }

  // For the switch link, keep existing params but flip to modal=login
  const qsObj = Object.fromEntries(sp ?? []);
  const switchHref = {
    pathname,
    query: {
      ...qsObj,
      modal: 'login',
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
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join Prince Foods to shop faster and track orders.</p>
      </div>

      <form onSubmit={onSubmit} className={styles.form} autoComplete="on">
        <div className={styles.grid2}>
          <div>
            <label className={styles.label} htmlFor="firstName">
              First name
            </label>
            <div className={styles.field}>
              <span className={styles.icon} aria-hidden>
                👤
              </span>
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
            <label className={styles.label} htmlFor="lastName">
              Last name
            </label>
            <div className={styles.field}>
              <span className={styles.icon} aria-hidden>
                👤
              </span>
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

        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <div className={styles.field}>
          <span className={styles.icon} aria-hidden>
            🔒
          </span>
          <input
            id="password"
            type={showPw ? 'text' : 'password'}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
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

        <label className={styles.label} htmlFor="phone">
          Phone{' '}
          <span style={{ fontWeight: 400, opacity: 0.6 }}>
            (optional — needed at checkout for delivery updates)
          </span>
        </label>
        <div className={styles.field}>
          <span className={styles.badge}>+44</span>
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

      <div className={styles.divider} role="separator">
        <span>or</span>
      </div>

      <Link href={switchHref} replace className={styles.link}>
        Already a member? Log in
      </Link>
    </div>
  );
}
