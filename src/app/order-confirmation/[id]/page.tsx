import { prisma } from '@/lib/prisma';
import styles from '@/styles/order-confirm.module.scss';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OrderConfirmationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      currency: true,
      subtotal: true,
      shippingTotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,
      // If you later add contactEmail via migration, you can add it to the select again
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

  const money = (p: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: order.currency }).format(
      (p || 0) / 100
    );

  return (
    <main className={styles.shell}>
      <h1>Thank you! Your order is confirmed.</h1>
      <p className={styles.sub}>
        Order <strong>#{order.id.slice(-8).toUpperCase()}</strong> •{' '}
        {new Date(order.createdAt).toLocaleString()}
      </p>

      <section className={styles.section}>
        <h3>Items</h3>
        <ul className={styles.items}>
          {order.items.map((it) => (
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
        <Link href="/account?tab=orders">view orders in your account</Link>.
      </p>

      <Link href="/shop" className={styles.btn}>
        Continue shopping
      </Link>
    </main>
  );
}
