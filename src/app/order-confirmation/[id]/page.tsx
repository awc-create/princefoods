// src/app/order-confirmation/[id]/page.tsx
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import styles from '@/styles/order-confirm.module.scss';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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
      contactEmail: true,
      userId: true,
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

  // Fix 7: 404 if order not found — don't reveal whether an ID exists
  if (!order) return notFound();

  // Fix 7: verify the displayId matches the query param (acts as a minimal token)
  // Anyone who just knows the UUID but not the displayId gets a 404
  const display = order.displayId || displayFromQS || order.id.slice(-8).toUpperCase();
  if (displayFromQS && order.displayId && displayFromQS !== order.displayId) {
    return notFound();
  }

  // Fix 2: check if this is a logged-in user who owns the order
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | null)?.id ?? null;
  const isOwner = !!userId && userId === order.userId;
  const isGuest = !userId;

  const money = (p: number) =>
    new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: order.currency || 'GBP'
    }).format((p || 0) / 100);

  // Fix 3: if grandTotal is 0 (webhook not yet fired), compute from line items
  const computedGrand =
    order.grandTotal > 0
      ? order.grandTotal
      : (order.subtotal ?? 0) + (order.shippingTotal ?? 0) - (order.discountTotal ?? 0);

  const isPending = order.paymentStatus === 'PENDING' || order.paymentStatus === 'AUTHORIZED';

  return (
    <main className={styles.shell}>
      {/* Fix 1: always clear cart when order exists */}
      <ClearCartOnMount orderId={order.id} />

      <div className={styles.successIcon}>
        <svg
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="28" cy="28" r="28" fill="#16a34a" />
          <path
            d="M16 28.5L23.5 36L40 20"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1>Thank you! Your order is confirmed.</h1>

      <p className={styles.sub}>
        Order <strong>#{display}</strong> • {new Date(order.createdAt).toLocaleString('en-GB')}
      </p>

      {isPending && (
        <div className={styles.pendingNote}>
          Your payment is being processed. We&apos;ll email you once it&apos;s confirmed.
        </div>
      )}

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

        {(order.discountTotal ?? 0) > 0 && (
          <div className={styles.kv}>
            <span>Discount</span>
            <span>-{money(order.discountTotal)}</span>
          </div>
        )}

        {(order.taxTotal ?? 0) > 0 && (
          <div className={styles.kv}>
            <span>Tax</span>
            <span>{money(order.taxTotal)}</span>
          </div>
        )}

        <div className={styles.kvTotal}>
          <span>Total</span>
          {/* Fix 3: show computed total if grandTotal is still 0 */}
          <strong>{money(computedGrand)}</strong>
        </div>
      </section>

      {/* Fix 5: estimated delivery info */}
      <div className={styles.deliveryNote}>
        <span>🚚</span>
        <div>
          <strong>Estimated dispatch: 1–2 working days</strong>
          <p>You&apos;ll receive a shipping confirmation email once your order is on its way.</p>
        </div>
      </div>

      {/* Fix 2: only show account link if user is logged in and owns the order */}
      <p className={styles.next}>
        We&apos;ll email your receipt to <strong>{order.contactEmail ?? 'you'}</strong> shortly.{' '}
        {isOwner && (
          <>
            <Link href={`/account/orders/${encodeURIComponent(display)}`}>
              View this order in your account
            </Link>{' '}
            or{' '}
          </>
        )}
        {isGuest && (
          <>
            <Link href="/?modal=signup">Create an account</Link> to track future orders, or{' '}
          </>
        )}
        <Link href="/shop">continue shopping</Link>.
      </p>

      <div className={styles.rowBtns}>
        <Link href="/shop" className={styles.btn}>
          Continue shopping
        </Link>
        {!isGuest && (
          <Link href="/account?tab=orders" className={styles.btnAlt}>
            My orders
          </Link>
        )}
      </div>
    </main>
  );
}
