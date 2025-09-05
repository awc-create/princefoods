import LoginForm from '@/components/auth/LoginForm';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic'; // optional but helps during "Collecting page data"

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
