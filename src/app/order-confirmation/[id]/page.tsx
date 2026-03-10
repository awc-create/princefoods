// src/app/order-confirmation/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import styles from '@/styles/order-confirm.module.scss';
import Link from 'next/link';
import ClearCartOnMount from './ClearCartOnMount';

export const dynamic = 'force-dynamic';

interface OrderItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export default async function OrderConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ d?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const displayFromQS = typeof sp.d === 'string' ? sp.d.trim() : '';

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      displayId: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      currency: true,
      subtotal: true,
      shippingTotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,
      items: {
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true
        }
      }
    }
  });

  if (!order) {
    return (
      <main className={styles.shell}>
        <h1>Order not found</h1>
        <p>
          We couldn’t find that order. <Link href="/">Go home</Link>
        </p>
      </main>
    );
  }

  const display = order.displayId || displayFromQS || order.id.slice(-8).toUpperCase();

  const money = (p: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: order.currency || 'GBP'
    }).format((p || 0) / 100);

  // ✅ Your enum:
  // PENDING | AUTHORIZED | CAPTURED | PARTIAL_REFUND | REFUNDED | FAILED
  // Only CAPTURED means payment completed.
  const shouldClear = order.paymentStatus === 'CAPTURED';

  return (
    <main className={styles.shell}>
      {/* ✅ Clear cart only after successful payment */}
      <ClearCartOnMount shouldClear={shouldClear} />

      <h1>Thank you! Your order is confirmed.</h1>

      <p className={styles.sub}>
        Order <strong>#{display}</strong> • {new Date(order.createdAt).toLocaleString()}
      </p>

      <section className={styles.section}>
        <h3>Items</h3>
        <ul className={styles.items}>
          {(order.items as OrderItem[]).map((it: OrderItem) => (
            <li key={it.id} className={styles.item}>
              <span className={styles.n}>{it.name}</span>
              <span className={styles.sku}>{it.sku ?? ''}</span>
              <span className={styles.qty}>×{it.quantity}</span>
              <span className={styles.price}>{money(it.lineTotal)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3>Summary</h3>

        <div className={styles.kv}>
          <span>Subtotal</span>
          <span>{money(order.subtotal)}</span>
        </div>

        <div className={styles.kv}>
          <span>Shipping</span>
          <span>{money(order.shippingTotal)}</span>
        </div>

        {order.discountTotal > 0 && (
          <div className={styles.kv}>
            <span>Discount</span>
            <span>-{money(order.discountTotal)}</span>
          </div>
        )}

        {order.taxTotal > 0 && (
          <div className={styles.kv}>
            <span>Tax</span>
            <span>{money(order.taxTotal)}</span>
          </div>
        )}

        <div className={styles.kvTotal}>
          <span>Total</span>
          <strong>{money(order.grandTotal)}</strong>
        </div>
      </section>

      <p className={styles.next}>
        We’ll email your receipt shortly. You can{' '}
        <Link href={`/account/orders/${encodeURIComponent(display)}`}>
          view this order in your account
        </Link>{' '}
        or <Link href="/account?tab=orders">view all orders</Link>.
      </p>

      <div className={styles.rowBtns}>
        <Link href="/shop" className={styles.btn}>
          Continue shopping
        </Link>

        <Link href="/account?tab=overview" className={styles.btnAlt}>
          My account
        </Link>
      </div>
    </main>
  );
}
