// src/app/admin/orders/page.tsx
import { Suspense } from 'react';
import OrdersClient from './orders-client';

export const dynamic = 'force-dynamic';

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <OrdersClient />
    </Suspense>
  );
}
