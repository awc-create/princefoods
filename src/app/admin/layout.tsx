// src/app/admin/layout.tsx
// Server Component — deliberately has NO 'use client' directive.
// In Next.js 15.3.x, a 'use client' layout segment corrupts the RSC
// clientReferenceManifest, causing "Cannot read properties of undefined
// (reading 'clientModules')" on every admin route request.
// All client-side logic (useSession, sidebar state, auth redirect) lives
// in AdminShell which is a proper 'use client' component.
import React from 'react';
import AdminShell from './AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
