// app/@modal/(.)login/page.tsx  ✅
'use client';
import React from 'react';

import Modal from '@/components/common/Modal';
import LoginForm from '@/components/auth/LoginForm';
export default function LoginModal() {
  return (
    <Modal title="Sign in">
      <LoginForm />
    </Modal>
  );
}
