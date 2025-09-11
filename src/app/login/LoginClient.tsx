// src/app/login/LoginClient.tsx
'use client';

import LoginForm from '@/components/auth/LoginForm';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { useSearchParams } from 'next/navigation';

export default function LoginClient() {
  const sp = useSearchParams();
  const queryCb = sp?.get('callbackUrl');
  const callbackUrl = safePublicCallbackUrl(queryCb);

  // Render the actual form and pass the normalised callback
  return <LoginForm callbackUrl={callbackUrl} />;
}
