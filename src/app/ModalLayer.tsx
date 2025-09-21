// src/app/ModalLayer.tsx
'use client';

import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignupForm';
import Lightbox from '@/components/common/Lightbox';
import { closeAuthModal } from '@/lib/close-auth-modal';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function ModalLayer() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams()!;

  const modal = sp.get('modal'); // 'login' | 'signup' | null
  const isOpen = modal === 'login' || modal === 'signup';
  const close = () => closeAuthModal(router, pathname, sp);

  if (!isOpen) return null;

  return (
    <Lightbox onClose={close} title={modal === 'login' ? 'Sign in' : 'Create account'}>
      {modal === 'login' ? <LoginForm /> : <SignupForm />}
    </Lightbox>
  );
}
