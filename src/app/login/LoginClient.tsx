// src/app/login/LoginClient.tsx
'use client';

import { useSearchParams } from 'next/navigation';

function safeCallbackUrl(raw: string | null) {
  // default to /admin, but never allow /admin/login (loop protection)
  if (!raw) return '/admin';
  return raw.startsWith('/admin/login') ? '/admin' : raw;
}

export default function LoginClient() {
  const sp = useSearchParams();
  const callbackUrl = safeCallbackUrl(sp.get('callbackUrl'));

  return <div>Login (redirect: {callbackUrl})</div>;
}
