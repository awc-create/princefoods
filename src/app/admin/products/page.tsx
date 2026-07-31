// src/app/admin/products/page.tsx
import { Suspense } from 'react';
import ProductsClient from './products-client';

export const dynamic = 'force-dynamic';

export default function AdminProductsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: '#6b7280' }}>Loading…</div>}>
      <ProductsClient />
    </Suspense>
  );
}
