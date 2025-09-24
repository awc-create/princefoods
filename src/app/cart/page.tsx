// src/app/cart/page.tsx
'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './cart.module.scss';

export default function CartPage() {
  const { items, updateQty, remove, subtotal, clear } = useCart();

  if (items.length === 0) {
    return (
      <main className={styles.shell}>
        <h1>Basket</h1>
        <p>Your basket is empty.</p>
        <Link className={styles.btn} href="/shop">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <h1>Basket</h1>
      <div className={styles.grid}>
        <section className={styles.lines}>
          <ul className={styles.list}>
            {items.map((it) => (
              <li key={it.id} className={styles.line}>
                <div className={styles.thumb}>
                  {it.image ? (
                    <Image src={it.image} alt="" width={72} height={72} />
                  ) : (
                    <div className={styles.ph} />
                  )}
                </div>
                <div className={styles.meta}>
                  <div className={styles.name}>{it.name}</div>
                  {it.sku && <div className={styles.sku}>{it.sku}</div>}
                  <div className={styles.price}>{penceToGBP(it.unitPrice)}</div>
                </div>
                <div className={styles.qtyRow}>
                  <button onClick={() => updateQty(it.id, it.quantity - 1)} aria-label="Decrease">
                    <Minus />
                  </button>
                  <span className={styles.qty}>{it.quantity}</span>
                  <button onClick={() => updateQty(it.id, it.quantity + 1)} aria-label="Increase">
                    <Plus />
                  </button>
                </div>
                <div className={styles.lineTotal}>{penceToGBP(it.unitPrice * it.quantity)}</div>
                <button className={styles.remove} onClick={() => remove(it.id)} aria-label="Remove">
                  <Trash2 />
                </button>
              </li>
            ))}
          </ul>
          <button className={styles.clear} onClick={clear}>
            Clear basket
          </button>
        </section>

        <aside className={styles.summary}>
          <h3>Summary</h3>
          <div className={styles.row}>
            <span>Subtotal</span>
            <span>{penceToGBP(subtotal())}</span>
          </div>
          <p className={styles.muted}>Shipping & taxes calculated at checkout.</p>
          <Link className={styles.checkout} href="/checkout">
            Checkout
          </Link>
        </aside>
      </div>
    </main>
  );
}
