'use client';

import { useEffect } from 'react';

export default function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'product_view', productId })
    }).catch(() => {});
  }, [productId]);

  return null;
}
