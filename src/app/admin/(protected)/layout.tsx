// src/app/admin/(protected)/layout.tsx
// Server Component — no 'use client'. Same fix as admin/layout.tsx.
import React from 'react';
import ProtectedAdminShell from './ProtectedAdminShell';

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedAdminShell>{children}</ProtectedAdminShell>;
}
