// Server Component (no "use client")

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
    // ✅ Wrap the client component that uses useSearchParams in Suspense
    <Suspense fallback={null}>
      <Modal title="Sign in" closeTo={callbackUrl}>
        {/* Replace with your real login UI if you have one */}
        <div style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, color: '#374151' }}>Please sign in to continue.</p>
        </div>
      </Modal>
    </Suspense>
  );
}
