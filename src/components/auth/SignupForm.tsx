'use client';

import styles from '@/app/signup/SignupPage.module.scss';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

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
  const currentFull = (() => {
    const qs = sp?.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  })();
  const callbackUrl = sp?.get('callbackUrl') ?? currentFull;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
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
            country: 'GB'
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
      callbackUrl
    }
  } as const;

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

        <label className={styles.label} htmlFor="phone">
          Phone (GB +44)
        </label>
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

      <div className={styles.divider} role="separator">
        <span>or</span>
      </div>

      <Link href={switchHref} replace className={styles.link}>
        Already a member? Log in
      </Link>
    </div>
  );
}
