// src/app/admin/login/layout.tsx
// Login page gets its own layout — bypasses the AdminLayout auth gate
import '@/styles/Global.scss';
import type { ReactNode } from 'react';

export default function AdminLoginLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
