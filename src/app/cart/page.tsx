// src/app/cart/page.tsx
import { Suspense } from 'react';
import styles from './CartPage.module.scss';

export const dynamic = 'force-dynamic';
export const revalidate = false;
export const fetchCache = 'force-no-store';

export default function CartPage() {
  return (
    <Suspense fallback={null}>
      <div className={styles.container}>
        <h1>Your Cart</h1>
        <p>No items in your cart.</p>
      </div>
    </Suspense>
  );
}
