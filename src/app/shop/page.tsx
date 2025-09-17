// src/app/shop/page.tsx
import { Suspense } from 'react';
import ShopClient from './ShopClient';

export const metadata = {
  title: 'Shop',
  description: 'Browse products from Prince Foods.'
};

// Helps ensure runtime fetching and avoids accidental static export
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function ShopFallback() {
  // Simple skeleton; keep inline so we don’t need extra CSS
  return (
    <div style={{ padding: '24px' }}>
      <div
        style={{
          maxWidth: 1240,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 24
        }}
      >
        <div style={{ height: 320, background: '#111', borderRadius: 12, opacity: 0.6 }} />
        <div>
          <div
            style={{
              height: 28,
              width: 180,
              background: '#111',
              borderRadius: 8,
              marginBottom: 16,
              opacity: 0.6
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 16
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{ height: 220, background: '#111', borderRadius: 12, opacity: 0.6 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopClient />
    </Suspense>
  );
}
