// src/app/verify/page.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

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
    <main className="mx-auto max-w-sm p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-6 w-64 bg-gray-200 rounded" />
        <div className="h-4 w-80 bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-200 rounded" />
        <div className="h-10 w-full bg-gray-200 rounded" />
        <div className="h-4 w-40 bg-gray-200 rounded" />
      </div>
    </main>
  );
}

function VerifyClient() {
  const sp = useSearchParams()!;
  const router = useRouter();

  const initialEmail = useMemo(() => sp.get('email') ?? '', [sp]);
  const token = useMemo(() => sp.get('token') ?? null, [sp]);
  const nextUrl = useMemo(() => sp.get('next') ?? '/', [sp]); // default home

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setEmail(initialEmail), [initialEmail]);

  // Auto-verify if token present
  useEffect(() => {
    const auto = async () => {
      if (!email || !token) return;
      setBusy(true);
      setErr(null);
      try {
        const res = await fetch('/api/auth/verify-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token })
        });
        const data = await res.json();
        if (data.ok) router.replace(nextUrl);
        else setErr(data.error ?? 'Verification failed');
      } catch {
        setErr('Verification failed');
      } finally {
        setBusy(false);
      }
    };
    void auto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, token]);

  async function submit() {
    if (!email || !code) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (data.ok) router.replace(nextUrl);
      else setErr(data.error ?? 'Verification failed');
    } catch {
      setErr('Verification failed');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email) return alert('Enter your email first.');
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/auth/send-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.ok) alert('Code sent');
      else setErr(data.error ?? 'Could not resend code');
    } catch {
      setErr('Could not resend code');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-xl font-semibold mb-2">Verify your account</h1>
      <p className="text-sm mb-4">Enter the 6-digit code we emailed to you.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="border p-2 w-full mb-2 rounded"
        type="email"
        autoComplete="email"
      />

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        placeholder="6-digit code"
        className="border p-2 w-full mb-4 rounded tracking-widest text-center"
        inputMode="numeric"
        autoComplete="one-time-code"
      />

      {err && <p className="text-red-600 mb-2">{err}</p>}

      <button onClick={submit} className="w-full border rounded p-2" disabled={busy}>
        {busy ? 'Verifying…' : 'Verify'}
      </button>
      <button onClick={resend} className="w-full mt-3 underline text-sm" disabled={busy}>
        Resend code
      </button>
    </main>
  );
}
