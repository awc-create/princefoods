// src/app/login/LoginClient.tsx
'use client';

import LoginForm from '@/components/auth/LoginForm';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { useSearchParams } from 'next/navigation';

// Google button only shown when explicitly enabled via env
const hasGoogle = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';

export default function LoginClient() {
  const sp = useSearchParams();
  const callbackUrl = safePublicCallbackUrl(sp?.get('callbackUrl'));
  return <LoginForm callbackUrl={callbackUrl} hasGoogle={hasGoogle} />;
}
