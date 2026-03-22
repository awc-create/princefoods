// src/app/admin/page.tsx
// Server Component — same pattern as the working Essentia admin project.
// The page itself is a server component; client logic lives in AdminDashboardClient.
import AdminDashboardClient from './AdminDashboardClient';

export default function AdminPage() {
  return <AdminDashboardClient />;
}
