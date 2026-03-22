// src/app/admin/layout.tsx
// Server Component — no 'use client'.
// A 'use client' layout segment breaks Next.js 15.3.x RSC manifests.
// All client logic lives in AdminShell.
import React from 'react';
import AdminShell from './AdminShell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
