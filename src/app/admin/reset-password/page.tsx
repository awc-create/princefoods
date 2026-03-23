// src/app/admin/reset-password/page.tsx
import { Suspense } from 'react';
import ResetPasswordClient from './ResetPasswordClient';

export const dynamic = 'force-dynamic';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordClient />
    </Suspense>
  );
}
