// src/components/ecommerce/login/LoginOrAccount.tsx
'use client';

import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';

const LoginButton = dynamic(() => import('./LoginButton'), { ssr: false });
const AccountMenu = dynamic(() => import('./AccountMenu'), { ssr: false });

export default function LoginOrAccount() {
  const { status } = useSession();

  if (status === 'loading') return <LoginButton />;
  return status === 'authenticated' ? <AccountMenu /> : <LoginButton />;
}
