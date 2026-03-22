// src/components/ecommerce/login/LoginOrAccount.tsx
'use client';

import { closeAuthModal } from '@/lib/close-auth-modal';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

const LoginButton = dynamic(() => import('./LoginButton'), { ssr: false });
const AccountMenu = dynamic(() => import('./AccountMenu'), { ssr: false });

export default function LoginOrAccount() {
  const { status, data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams()!;
  const prevStatus = useRef(status);

  // When status transitions to authenticated (e.g. after OAuth redirect):
  // 1. Close any open auth modal (?modal=login|signup) so it doesn't linger
  // 2. Force a router refresh so all server components re-render with the session
  useEffect(() => {
    if (prevStatus.current !== 'authenticated' && status === 'authenticated') {
      // Close the auth modal if it's open
      const modal = sp.get('modal');
      if (modal === 'login' || modal === 'signup') {
        closeAuthModal(router, pathname, sp);
      }
      router.refresh();
    }
    prevStatus.current = status;
  }, [status, router, pathname, sp]);

  // During loading, render nothing — showing LoginButton here would let the
  // user open the sign-in modal before the session has resolved, causing the
  // "logged in but modal still shows" symptom.
  if (status === 'loading') return null;

  return status === 'authenticated' ? (
    <AccountMenu name={session?.user?.name} email={session?.user?.email} />
  ) : (
    <LoginButton />
  );
}
