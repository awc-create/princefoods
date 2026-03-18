// src/app/order-confirmation/[id]/ClearCartOnMount.tsx
'use client';

import { useCart } from '@/lib/cart-store';
import { useEffect } from 'react';

// Fix 1: clear cart whenever we land on the confirmation page —
// the order existing means it was placed successfully.
// We don't wait for CAPTURED because the webhook may not have fired yet.
export default function ClearCartOnMount({ orderId }: { orderId: string }) {
  const { clear } = useCart();

  useEffect(() => {
    if (!orderId) return;
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return null;
}
