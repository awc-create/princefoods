// src/components/ecommerce/login/LoginOrAccount.tsx
'use client';

import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';

// keep your existing files
const LoginButton = dynamic(() => import('./LoginButton'), { ssr: false });
const AccountMenu = dynamic(() => import('./AccountMenu'), { ssr: false });

export default function LoginOrAccount() {
  const { status } = useSession();

  // while loading, keep UI stable (show login icon)
  if (status === 'loading') return <LoginButton />;

  return status === 'authenticated' ? <AccountMenu /> : <LoginButton />;
}
