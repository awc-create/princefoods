import AdminLoginClient from '@/app/admin/login/AdminLoginClient';
import Modal from '@/components/common/Modal';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default function AdminLoginModalPage() {
  return (
    <Modal title="Admin sign in">
      <Suspense fallback={null}>
        <AdminLoginClient />
      </Suspense>
    </Modal>
  );
}
