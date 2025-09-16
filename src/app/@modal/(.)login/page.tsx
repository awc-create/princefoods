// src/app/@modal/(.)login/page.tsx
// Server Component (no "use client")

import Modal from '@/components/common/Modal';
// import YourLoginForm from '@/components/ecommerce/login/LoginForm'; // if you have one

interface Search {
  callbackUrl?: string;
}

/**
 * NOTE: In this codebase PageProps expects searchParams to be a Promise.
 * We make the page async and await it to satisfy the constraint.
 */
export default async function LoginModalPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const sp = (await searchParams) ?? {};
  const callbackUrl = sp.callbackUrl ?? '/';

  return (
    <Modal title="Sign in" closeTo={callbackUrl}>
      {/* Replace this block with your real login UI */}
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, color: '#374151' }}>Please sign in to continue.</p>
        {/* <YourLoginForm callbackUrl={callbackUrl} /> */}
      </div>
    </Modal>
  );
}
