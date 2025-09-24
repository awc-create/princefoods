// src/components/ecommerce/basket/CartDrawer.tsx
'use client';

import { useCart } from '@/lib/cart-store';
import { penceToGBP } from '@/lib/money';
import { Minus, Plus, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './CartDrawer.module.scss';

export default function CartDrawer() {
  const { isOpen, close, items, updateQty, remove, subtotal } = useCart();

  return (
    <>
      {isOpen && <div className={styles.backdrop} onClick={close} />}
      <aside className={`${styles.drawer} ${isOpen ? styles.open : ''}`} aria-hidden={!isOpen}>
        <header className={styles.header}>
          <h3>Basket</h3>
          <button className={styles.icon} onClick={close} aria-label="Close cart">
            <X />
          </button>
        </header>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <p>Your basket is empty.</p>
            <Link className={styles.btn} href="/shop" onClick={close}>
              Start shopping
            </Link>
          </div>
        ) : (
          <>
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
                    <div className={styles.name}>{it.name}</div>
                    {it.sku && <div className={styles.sku}>{it.sku}</div>}
                    <div className={styles.price}>{penceToGBP(it.unitPrice)}</div>
                    <div className={styles.qtyRow}>
                      <button
                        onClick={() => updateQty(it.id, it.quantity - 1)}
                        aria-label="Decrease"
                      >
                        <Minus width={16} height={16} />
                      </button>
                      <span className={styles.qty}>{it.quantity}</span>
                      <button
                        onClick={() => updateQty(it.id, it.quantity + 1)}
                        aria-label="Increase"
                      >
                        <Plus width={16} height={16} />
                      </button>
                    </div>
                  </div>
                  <button
                    className={styles.remove}
                    onClick={() => remove(it.id)}
                    aria-label="Remove"
                  >
                    <Trash2 width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>

            <footer className={styles.footer}>
              <div className={styles.row}>
                <span>Subtotal</span>
                <strong>{penceToGBP(subtotal())}</strong>
              </div>
              <p className={styles.muted}>Shipping & taxes calculated at checkout.</p>
              <Link className={styles.cta} href="/cart" onClick={close}>
                Review basket
              </Link>
              <Link className={styles.ctaPrimary} href="/checkout" onClick={close}>
                Checkout
              </Link>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
