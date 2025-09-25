'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import Image from 'next/image';
import Link from 'next/link';
import styles from './CartDrawer.module.scss';

export default function CartDrawer() {
  const { items, isOpen, toggle, updateQty, remove, subtotal } = useCart();

  if (!isOpen) return null;

  return (
    <aside className={styles.host} aria-modal="true" role="dialog" aria-label="Basket">
      <div className={styles.backdrop} onClick={toggle} />
      <div className={styles.panel}>
        <header className={styles.header}>
          <h3>Basket</h3>
          <button onClick={toggle} aria-label="Close basket">
            ×
          </button>
        </header>

        <ul className={styles.list}>
          {items.map((it) => (
            <li key={it.id} className={styles.line}>
              <div className={styles.thumb}>
                {it.image ? (
                  <Image src={it.image} alt="" width={56} height={56} />
                ) : (
                  <div className={styles.ph} />
                )}
              </div>

              <div className={styles.meta}>
                <div className={styles.name} title={it.name}>
                  {it.name}
                </div>
                {it.sku && <div className={styles.sku}>{it.sku}</div>}
                <div className={styles.unit}>{penceToGBP(it.unitPrice)}</div>
              </div>

              <div className={styles.qtyRow}>
                <button onClick={() => updateQty(it.id, it.quantity - 1)} aria-label="Decrease">
                  −
                </button>
                <span className={styles.qty}>{it.quantity}</span>
                <button onClick={() => updateQty(it.id, it.quantity + 1)} aria-label="Increase">
                  +
                </button>
              </div>

              <div className={styles.lineTotal}>{penceToGBP(it.unitPrice * it.quantity)}</div>

              <button className={styles.remove} onClick={() => remove(it.id)} aria-label="Remove">
                ×
              </button>
            </li>
          ))}

          {items.length === 0 && <li className={styles.empty}>Your basket is empty.</li>}
        </ul>

        <div className={styles.summary}>
          <span>Subtotal</span>
          <strong>{penceToGBP(subtotal())}</strong>
        </div>

        <footer className={styles.footer}>
          <Link href="/cart" onClick={toggle} className={styles.linkBtn}>
            View basket
          </Link>
          <Link href="/checkout" onClick={toggle} className={styles.primaryBtn}>
            Checkout
          </Link>
        </footer>
      </div>
    </aside>
  );
}
