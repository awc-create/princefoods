'use client';

import { useSearchParams } from 'next/navigation';

function safeCallbackUrl(raw: string | null) {
  if (!raw) return '/admin';
  return raw.startsWith('/admin/login') ? '/admin' : raw;
}

export default function LoginClient() {
  const sp = useSearchParams();
  const callbackUrl = safeCallbackUrl(sp?.get('callbackUrl') ?? null); // ← guard for null

  return <div>Login (redirect: {callbackUrl})</div>;
}
