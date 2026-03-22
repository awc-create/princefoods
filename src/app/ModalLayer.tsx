// src/app/ModalLayer.tsx
'use client';

import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignupForm';
import Lightbox from '@/components/common/Lightbox';
import { closeAuthModal } from '@/lib/close-auth-modal';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export default function ModalLayer() {
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams()!;

  const modal = sp.get('modal'); // 'login' | 'signup' | null
  const isOpen = modal === 'login' || modal === 'signup';
  const close = () => closeAuthModal(router, pathname, sp);

  // If the session resolves as authenticated while the auth modal is open
  // (e.g. after a Google OAuth redirect that lands back with ?modal still in the URL,
  // or when the user was already signed in), dismiss the modal automatically.
  useEffect(() => {
    if (status === 'authenticated' && isOpen) {
      close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isOpen]);

  if (!isOpen) return null;

  return (
    <Lightbox onClose={close} title={modal === 'login' ? 'Sign in' : 'Create account'}>
      {modal === 'login' ? <LoginForm /> : <SignupForm />}
    </Lightbox>
  );
}
