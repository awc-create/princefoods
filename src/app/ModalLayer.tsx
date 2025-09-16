'use client';

import LoginForm from '@/components/auth/LoginForm';
import SignupForm from '@/components/auth/SignupForm';
import Lightbox from '@/components/common/Lightbox';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export default function ModalLayer() {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const sp = useSearchParams();

  const modal = sp?.get('modal'); // 'login' | 'signup' | null
  const isOpen = modal === 'login' || modal === 'signup';

  // Keep all current query params except `modal`
  const baseHref = useMemo(() => {
    const entries = Array.from(sp?.entries?.() ?? []);
    const kept = entries.filter(([k]) => k !== 'modal');
    const qs = new URLSearchParams(kept);
    const next = qs.toString();
    return next ? `${pathname}?${next}` : pathname;
  }, [pathname, sp]);

  const close = () => router.replace(baseHref, { scroll: false });

  if (!isOpen) return null;

  return (
    <Lightbox onClose={close} title={modal === 'login' ? 'Sign in' : 'Create account'}>
      {modal === 'login' ? <LoginForm /> : <SignupForm />}
    </Lightbox>
  );
}
