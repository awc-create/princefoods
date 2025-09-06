// src/app/@modal/(.)signup/page.tsx
import SignupForm from '@/components/auth/SignupForm';
import Modal from '@/components/common/Modal';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic'; // optional; prevents static prerender

export default function SignupModalPage() {
  return (
    <Modal title="Create account">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </Modal>
  );
}
