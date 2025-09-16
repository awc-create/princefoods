// src/app/@modal/(.)login/page.tsx
import LoginForm from '@/components/auth/LoginForm';
import Modal from '@/components/common/Modal';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function _CloseTo() {
  // little server component that reads searchParams via URL (Next 15 route segment)
  // If you prefer client, you can pass it through LoginForm props instead.
  return null;
}

export default function LoginModalPage({
  searchParams
}: {
  searchParams?: { callbackUrl?: string };
}) {
  const closeTo = safePublicCallbackUrl(searchParams?.callbackUrl ?? null);
  return (
    <Modal title="Sign in" closeTo={closeTo}>
      <Suspense fallback={null}>
        <LoginForm callbackUrl={closeTo} />
      </Suspense>
    </Modal>
  );
}
