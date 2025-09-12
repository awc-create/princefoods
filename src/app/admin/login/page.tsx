// server component
import { Suspense } from 'react';
import AdminLoginClient from './AdminLoginClient';

// ensures this page always renders dynamically (avoids static pre-render issues)
export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginClient />
    </Suspense>
  );
}
