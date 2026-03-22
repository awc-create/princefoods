// Server Component (no "use client")

import LoginClient from '@/app/login/LoginClient';
import Modal from '@/components/common/Modal';
import { Suspense } from 'react';

interface Search {
  callbackUrl?: string;
}

export const dynamic = 'force-dynamic';

export default async function LoginModalPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const sp = (await searchParams) ?? {};
  const callbackUrl = sp.callbackUrl ?? '/';

  return (
    <Suspense fallback={null}>
      <Modal title="Sign in" closeTo={callbackUrl}>
        <LoginClient />
      </Modal>
    </Suspense>
  );
}
