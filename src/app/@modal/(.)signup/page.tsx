// src/app/@modal/(.)signup/page.tsx
import SignupForm from '@/components/auth/SignupForm';
import Modal from '@/components/common/Modal';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function SignupModalPage({
  searchParams
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const closeTo = safePublicCallbackUrl(searchParams?.callbackUrl ?? null);
  return (
    <Modal title="Create account" closeTo={closeTo}>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </Modal>
  );
}
