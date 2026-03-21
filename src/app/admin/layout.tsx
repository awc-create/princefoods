// src/app/admin/layout.tsx
// Server component — auth gate runs server-side in Node.js
// /admin/login has its own layout.tsx and bypasses this
import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import AdminShell from './AdminShell';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: Role } | undefined)?.role;
  const authorised = !!session && (role === 'HEAD' || role === 'STAFF');

  if (!authorised) {
    redirect('/admin/login');
  }

  return <AdminShell>{children}</AdminShell>;
}
