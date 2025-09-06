// src/app/@modal/(.)signup/page.tsx
'use client';

import SignupForm from '@/components/auth/SignupForm';
import Modal from '@/components/common/Modal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function SignupModalPage() {
  return (
    <Modal>
      <SignupForm />
    </Modal>
  );
}
