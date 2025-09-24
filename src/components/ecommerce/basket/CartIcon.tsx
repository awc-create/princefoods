// src/components/ecommerce/basket/CartIcon.tsx
'use client';

import { useCart } from '@/lib/cart-store';
import { ShoppingCart } from 'lucide-react';
import styles from './CartIcon.module.scss';

export default function CartIcon() {
  const open = useCart((s) => s.open);
  const count = useCart((s) => s.count());

  return (
    <button className={styles.icon} aria-label="Open cart" onClick={open}>
      <ShoppingCart />
      {count > 0 && <span className={styles.badge}>{count}</span>}
    </button>
  );
}
