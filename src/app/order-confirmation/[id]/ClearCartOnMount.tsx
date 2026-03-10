// src/app/order-confirmation/[id]/ClearCartOnMount.tsx
'use client';

import { useCart } from '@/lib/cart-store';
import { useEffect } from 'react';

export default function ClearCartOnMount({ shouldClear }: { shouldClear: boolean }) {
  const { clear } = useCart();

  useEffect(() => {
    if (!shouldClear) return;
    clear();
  }, [clear, shouldClear]);

  return null;
}
