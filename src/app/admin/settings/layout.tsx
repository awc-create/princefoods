// src/app/admin/settings/layout.tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';

export default async function AdminSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard: must be logged in AND HEAD
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // bounce to admin login, back to /admin/settings after auth
    redirect('/admin/login?callbackUrl=/admin/settings');
  }

  const role = (session.user as any).role as 'HEAD' | 'STAFF' | 'VIEWER' | undefined;
  if (role !== 'HEAD') {
    // non-HEAD users can’t view settings
    redirect('/admin');
  }

  return <>{children}</>;
}
