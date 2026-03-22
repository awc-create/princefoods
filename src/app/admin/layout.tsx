// src/app/admin/layout.tsx
import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import AdminShell from './AdminShell';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') ?? '';

  console.log('[AdminLayout] pathname from header:', JSON.stringify(pathname));

  // Let login page through
  if (pathname.startsWith('/admin/login')) {
    console.log('[AdminLayout] login page — bypassing auth');
    return <>{children}</>;
  }

  let session;
  try {
    session = await getServerSession(authOptions);
    console.log(
      '[AdminLayout] session:',
      JSON.stringify({
        exists: !!session,
        email: session?.user?.email ?? null,
        role: (session?.user as { role?: string } | undefined)?.role ?? null
      })
    );
  } catch (err) {
    console.error('[AdminLayout] getServerSession threw:', err);
    redirect('/admin/login?error=session_error');
  }

  const role = (session?.user as { role?: Role } | undefined)?.role;
  const authorised = !!session && (role === 'HEAD' || role === 'STAFF');

  console.log('[AdminLayout] authorised:', authorised);

  if (!authorised) {
    const cb = encodeURIComponent(pathname || '/admin');
    console.log('[AdminLayout] not authorised — redirecting to login');
    redirect(`/admin/login?callbackUrl=${cb}`);
  }

  return <AdminShell>{children}</AdminShell>;
}
