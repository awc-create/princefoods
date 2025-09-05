// src/app/admin/settings/layout.tsx
import React from 'react';

import { authOptions } from '@/lib/auth-options';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';
interface SessionUserWithRole {
  role?: Role | null;
}

function hasRole(u: unknown): u is SessionUserWithRole {
  return !!u && typeof u === 'object' && 'role' in (u as Record<string, unknown>);
}

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  // Server-side guard: must be logged in AND HEAD
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // bounce to admin login, back to /admin/settings after auth
    redirect('/admin/login?callbackUrl=/admin/settings');
  }

  const role = hasRole(session.user) ? (session.user.role ?? undefined) : undefined;
  if (role !== 'HEAD') {
    // non-HEAD users can’t view settings
    redirect('/admin');
  }

  return <>{children}</>;
}
