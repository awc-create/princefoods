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
  const sp = useSearchParams();
  const router = useRouter();

  // Safely read query params with Suspense present
  const initialEmail = useMemo(() => sp.get('email') ?? '', [sp]);
  const token = useMemo(() => sp.get('token') ?? null, [sp]);

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  // Auto-verify if token present
  useEffect(() => {
    const auto = async () => {
      if (!email || !token) return;
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token })
      });
      const data = await res.json();
      if (data.ok) router.replace('/account');
    };
    void auto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, token]);

  async function submit() {
    if (!email || !code) return;
    const res = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    const data = await res.json();
    if (data.ok) router.push('/account');
    else alert(data.error ?? 'Verification failed');
  }

  async function resend() {
    if (!email) return alert('Enter your email first.');
    const res = await fetch('/api/auth/send-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (data.ok) alert('Code sent');
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
      <button onClick={submit} className="w-full border rounded p-2">
        Verify
      </button>
      <button onClick={resend} className="w-full mt-3 underline text-sm">
        Resend code
      </button>
    </main>
  );
}
