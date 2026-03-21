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

  // Let login page through — it has its own layout but Next.js still runs parent layouts
  if (pathname.startsWith('/admin/login')) {
    return <>{children}</>;
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: Role } | undefined)?.role;
  const authorised = !!session && (role === 'HEAD' || role === 'STAFF');

  if (!authorised) {
    const cb = encodeURIComponent(pathname || '/admin');
    redirect(`/admin/login?callbackUrl=${cb}`);
  }

  return <AdminShell>{children}</AdminShell>;
}
