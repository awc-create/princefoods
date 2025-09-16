// src/app/@modal/(.)signup/page.tsx
// Server Component (no "use client")

import SignupForm from '@/components/auth/SignupForm';
import Modal from '@/components/common/Modal';
import { safePublicCallbackUrl } from '@/lib/auth-redirect';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

interface Search {
  callbackUrl?: string;
}

export default async function SignupModalPage({
  searchParams
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = (await searchParams) ?? {};
  const closeTo = safePublicCallbackUrl(sp.callbackUrl ?? null);

  return (
    <Modal title="Create account" closeTo={closeTo}>
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </Modal>
  );
}
