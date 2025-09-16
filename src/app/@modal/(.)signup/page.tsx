import SignupForm from '@/components/auth/SignupForm';
import Modal from '@/components/common/Modal';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic'; // ensure modal always renders fresh

export default function SignupModalPage() {
  return (
    <Modal title="Create account">
      <Suspense fallback={<p>Loading…</p>}>
        <SignupForm />
      </Suspense>
    </Modal>
  );
}
