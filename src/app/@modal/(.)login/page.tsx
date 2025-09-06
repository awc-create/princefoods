// app/@modal/(.)login/page.tsx  ✅
'use client';
import LoginForm from '@/components/auth/LoginForm';
import Modal from '@/components/common/Modal';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function LoginModalPage() {
  return (
    <Modal title="Sign in">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </Modal>
  );
}
