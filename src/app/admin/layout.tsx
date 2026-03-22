// src/app/admin/layout.tsx
// Server Component — no 'use client'.
// force-dynamic ensures Next.js 15.3.x generates the client reference
// manifest correctly for the admin route subtree. Without it, the manifest
// is empty ({}) and clientReferenceManifest.clientModules is undefined,
// causing a 500 on every admin route.
import React from 'react';
import AdminShell from './AdminShell';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
