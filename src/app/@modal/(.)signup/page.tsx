// app/@modal/(.)signup/page.tsx
'use client';
import Modal from '@/components/common/Modal';
import SignupForm from '@/components/auth/SignupForm';

export default function SignupModalPage() {
  return (
    <Modal>
      <SignupForm />
    </Modal>
  );
}
