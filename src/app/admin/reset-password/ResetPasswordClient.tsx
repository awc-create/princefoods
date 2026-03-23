'use client';
// src/app/admin/reset-password/ResetPasswordClient.tsx
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import styles from '../login/Login.module.scss';

export default function ResetPasswordClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp?.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (newPassword.length < 6) {
      setErr('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/admin/staff/do-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json().catch(() => ({ ok: false, message: 'Server error' }));
      if (!res.ok || !data.ok) {
        setErr(data.message ?? 'Reset failed. The link may have expired.');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.replace('/admin/login'), 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unexpected error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <main className={styles.screen}>
        <div className={styles.card}>
          <p style={{ color: '#dc2626', textAlign: 'center' }}>Invalid or missing reset token.</p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <Image
            src="/assets/prince-foods-logo.png"
            alt="Prince Foods"
            width={120}
            height={64}
            priority
            className={styles.logo}
          />
          <h1 className={styles.title}>Set New Password</h1>
          <p className={styles.subtitle}>Enter a new password for this staff account.</p>
        </div>

        {success ? (
          <div style={{ textAlign: 'center', color: '#16a34a', padding: '16px 0' }}>
            ✅ Password updated. Redirecting to login…
          </div>
        ) : (
          <form onSubmit={onSubmit} className={styles.form} autoComplete="off">
            {err && (
              <div className={styles.error} role="alert">
                {err}
              </div>
            )}

            <div className={styles.rowBetween}>
              <label className={styles.label} htmlFor="newPassword">
                New password
              </label>
              <button type="button" className={styles.linkBtn} onClick={() => setShowPw((s) => !s)}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="newPassword"
              type={showPw ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className={styles.input}
              disabled={pending}
              autoComplete="new-password"
              placeholder="••••••••"
            />

            <label className={styles.label} htmlFor="confirmPassword" style={{ marginTop: 16 }}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type={showPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className={styles.input}
              disabled={pending}
              autoComplete="new-password"
              placeholder="••••••••"
            />

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={pending}
              style={{ marginTop: 24 }}
            >
              {pending ? 'Updating…' : 'Set password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
