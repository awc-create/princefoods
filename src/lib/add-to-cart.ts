// src/lib/add-to-cart.ts
'use client';

import { CartLine, useCart } from './cart-store';

export function useAddToCart() {
  const add = useCart((s) => s.add);
  return (line: Omit<CartLine, 'quantity'> & { quantity?: number }) => add(line);
}
