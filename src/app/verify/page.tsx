'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import styles from './VerifyPage.module.scss';

export const dynamic = 'force-dynamic';

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyClient />
    </Suspense>
  );
}

function VerifyFallback() {
  return (
    <main className={styles.page}>
      <div className={styles.wrapper}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Verify your account</h1>
            <p className={styles.subtitle}>Loading…</p>
          </div>
          <div className={styles.otpGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.otpBox} aria-hidden="true" />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function VerifyClient() {
  const sp = useSearchParams()!;
  const router = useRouter();

  const initialEmail = useMemo(() => sp.get('email') ?? '', [sp]);
  const token = useMemo(() => sp.get('token') ?? null, [sp]);
  const nextUrl = useMemo(() => sp.get('next') ?? '/', [sp]);

  const [email, setEmail] = useState<string>(
    () =>
      initialEmail ||
      (typeof window !== 'undefined' ? (localStorage.getItem('verify:email') ?? '') : '')
  );
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const COOLDOWN = 60;
  const [cooldown, setCooldown] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const last = +(localStorage.getItem('verify:lastResend') ?? 0);
    const elapsed = Math.floor((Date.now() - last) / 1000);
    return Math.max(0, COOLDOWN - elapsed);
  });

  useEffect(() => setEmail((e) => initialEmail || e), [initialEmail]);
  useEffect(() => localStorage.setItem('verify:email', email || ''), [email]);
  useEffect(() => {
    if (!cooldown) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    const i = digits.findIndex((d) => !d);
    if (i >= 0) inputsRef.current[i]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-verify by token
  useEffect(() => {
    const auto = async () => {
      if (!email || !token) return;
      setBusy(true);
      setErr(null);
      setOk('Verifying your link…');
      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token })
        });
        const data = await res.json();
        if (data.ok) {
          setOk('Verified! Redirecting…');
          router.replace(nextUrl);
        } else {
          setErr(data.error ?? 'Verification failed');
          setOk(null);
          triggerShake();
        }
      } catch {
        setErr('Verification failed');
        setOk(null);
        triggerShake();
      } finally {
        setBusy(false);
      }
    };
    void auto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, token]);

  const code = digits.join('');

  function maskEmail(str: string) {
    if (!str.includes('@')) return str;
    const [user, domain] = str.split('@');
    return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 340);
  }

  // OTP handlers
  function onChangeDigit(i: number, val: string) {
    const clean = val.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = clean;
      return next;
    });
    if (clean && i < 5) inputsRef.current[i + 1]?.focus();
  }
  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      setDigits((p) => {
        const n = [...p];
        n[i - 1] = '';
        return n;
      });
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputsRef.current[i + 1]?.focus();
    if (e.key === 'Enter') void handleSubmit();
  }
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = text.split('');
    while (next.length < 6) next.push('');
    setDigits(next);
    if (text.length === 6) void handleSubmit();
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email || code.length !== 6) return;
    setBusy(true);
    setErr(null);
    setOk('Verifying…');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (data.ok) {
        setOk('Verified! Redirecting…');
        router.replace(nextUrl);
      } else {
        setErr(data.error ?? 'Incorrect code');
        setOk(null);
        triggerShake();
      }
    } catch {
      setErr('Verification failed');
      setOk(null);
      triggerShake();
    } finally {
      setBusy(false);
    }
  }

  // Resend
  async function resend() {
    if (!email) {
      setErr('Enter your email first.');
      triggerShake();
      return;
    }
    if (cooldown > 0) return;
    setBusy(true);
    setErr(null);
    setOk('Sending a new code…');
    try {
      const res = await fetch('/api/auth/send-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resend: true })
      });
      const data = await res.json();
      if (data.ok) {
        setOk('If that email started verification, a new code is on the way.');
        setDigits(['', '', '', '', '', '']);
        localStorage.setItem('verify:lastResend', String(Date.now()));
        setCooldown(COOLDOWN);
      } else {
        setErr(data.error ?? 'Could not resend code');
        setOk(null);
        triggerShake();
      }
    } catch {
      setErr('Could not resend code');
      setOk(null);
      triggerShake();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.wrapper}>
        <form
          onSubmit={handleSubmit}
          className={`${styles.card} ${shake ? styles.shake : ''}`}
          aria-describedby="verify-help"
        >
          <div className={styles.header}>
            <h1 className={styles.title}>Verify your account</h1>
            <p id="verify-help" className={styles.subtitle}>
              Enter the 6-digit code we emailed to{' '}
              <strong>{maskEmail(email) || 'your email'}</strong>.
            </p>
          </div>

          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            ref={emailRef}
            id="email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
          />

          <div className={styles.otpWrap}>
            <label className={styles.label}>6-digit code</label>
            <div className={styles.otpGrid}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  className={styles.otpBox}
                  value={d}
                  onChange={(e) => onChangeDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onPaste={onPaste}
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  aria-label={`Digit ${i + 1}`}
                  maxLength={1}
                />
              ))}
            </div>
            <p className={styles.helper}>
              Pro tip: paste the whole code — we’ll fill the boxes for you.
            </p>
          </div>

          {err && <p className={`${styles.status} error`}>{err}</p>}
          {ok && <p className={`${styles.status} success`}>{ok}</p>}

          <div className={styles.actions}>
            <button
              type="submit"
              className={`${styles.btn} ${styles.primary}`}
              disabled={busy || code.length !== 6}
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={resend}
              className={`${styles.btn} ${styles.linky}`}
              disabled={busy || cooldown > 0}
              aria-disabled={busy || cooldown > 0}
              title="Only available for emails that already started verification"
            >
              {cooldown > 0
                ? `Resend code in ${String(Math.floor(cooldown / 60)).padStart(2, '0')}:${String(cooldown % 60).padStart(2, '0')}`
                : 'Resend code'}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.clear}`}
              onClick={() => {
                setDigits(['', '', '', '', '', '']);
                setErr(null);
                setOk(null);
                emailRef.current?.focus();
              }}
            >
              Use a different email
            </button>
          </div>
        </form>

        <p className={styles.footer}>
          Didn’t receive an email? Check spam or search for “verification code”.
        </p>
      </div>
    </main>
  );
}
