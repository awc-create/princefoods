// src/app/account/orders/[displayId]/page.tsx
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from './order-detail.module.scss';

export const dynamic = 'force-dynamic';

// Fix 4: human-friendly status labels
function orderStatusLabel(s: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft',
    PLACED: 'Order placed',
    PAID: 'Payment received',
    FULFILLED: 'Fulfilled',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded'
  };
  return map[s?.toUpperCase()] ?? s;
}

function paymentStatusLabel(s: string): string {
  const map: Record<string, string> = {
    PENDING: 'Awaiting payment',
    AUTHORIZED: 'Authorised',
    CAPTURED: 'Payment received',
    PARTIAL_REFUND: 'Partially refunded',
    REFUNDED: 'Refunded',
    FAILED: 'Payment failed'
  };
  return map[s?.toUpperCase()] ?? s;
}

function money(currency: string, pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((pence ?? 0) / 100);
}

export default async function AccountOrderPage({
  params
}: {
  params: Promise<{ displayId: string }>;
}) {
  const { displayId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/?modal=login&next=/account?tab=orders');

  const userId = (session.user as { id?: string })?.id;

  // Fix 3: query Prisma directly instead of internal HTTP fetch
  const order = await prisma.order.findFirst({
    where: {
      displayId,
      // Ensure the order belongs to this user (or their email for guest orders)
      OR: [...(userId ? [{ userId }] : []), { contactEmail: session.user.email }]
    },
    select: {
      id: true,
      displayId: true,
      status: true,
      paymentStatus: true,
      currency: true,
      subtotal: true,
      shippingTotal: true,
      discountTotal: true,
      taxTotal: true,
      grandTotal: true,
      totalWeightGrams: true,
      createdAt: true,
      contactEmail: true,
      items: {
        select: {
          id: true,
          name: true,
          sku: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          imageUrl: true
        }
      },
      shippingAddress: true,
      billingAddress: true,
      shipments: {
        select: {
          id: true,
          carrier: true,
          status: true,
          serviceCode: true,
          waybill: true,
          trackingNumber: true,
          trackingUrl: true,
          shippedAt: true,
          labelMime: true
        },
        orderBy: { shippedAt: 'desc' }
      }
    }
  });

  if (!order) redirect('/account?tab=orders');

  const primaryTracking =
    order.shipments.find((s) => s.trackingUrl ?? s.trackingNumber) ?? order.shipments[0] ?? null;

  return (
    <main className={styles.shell}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.h1}>Order #{order.displayId}</h1>
          <p className={styles.sub}>
            Placed {new Date(order.createdAt).toLocaleString('en-GB')} •{' '}
            {/* Fix 4: friendly labels */}
            <span>{orderStatusLabel(order.status)}</span> •{' '}
            <span>{paymentStatusLabel(order.paymentStatus)}</span>
          </p>
        </div>
        <Link className={styles.back} href="/account?tab=orders">
          ← Back to orders
        </Link>
      </header>

      {/* Delivery & tracking */}
      <section className={styles.card}>
        <h2 className={styles.h2}>Delivery & tracking</h2>
        {!order.shipments.length ? (
          <p className={styles.note}>
            Not dispatched yet. We'll email tracking once it's on the way.
          </p>
        ) : (
          <>
            {primaryTracking?.trackingNumber || primaryTracking?.waybill ? (
              <div className={styles.badgesRow}>
                <span className={styles.badgeMuted}>
                  Carrier: {primaryTracking?.carrier || 'Carrier'}
                </span>
                <span className={styles.badgeMuted}>
                  Status: {primaryTracking?.status || 'PENDING'}
                </span>
                <span className={styles.badgeMuted}>
                  Tracking: {primaryTracking?.trackingNumber ?? primaryTracking?.waybill ?? '—'}
                </span>
              </div>
            ) : (
              <p className={styles.note}>Tracking is being generated. Please check back shortly.</p>
            )}
            {primaryTracking?.trackingUrl && (
              <div className={styles.trackRow}>
                <a
                  className={styles.trackBtn}
                  href={primaryTracking.trackingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Track parcel
                </a>
              </div>
            )}
          </>
        )}
      </section>

      {/* Items */}
      <section className={styles.card}>
        <h2 className={styles.h2}>Items</h2>
        <ul className={styles.items}>
          {(() => {
            // Free items (BOGOF) are stored as £0 separate lines — group with paid lines by product name
            const freeLines = order.items.filter((it) => it.unitPrice === 0);
            const paidLines = order.items.filter((it) => it.unitPrice > 0);
            const freeByName = new Map<string, number>();
            for (const f of freeLines) {
              freeByName.set(
                f.name.toLowerCase(),
                (freeByName.get(f.name.toLowerCase()) ?? 0) + f.quantity
              );
            }

            return paidLines.map((it) => {
              const freeQty = freeByName.get(it.name.toLowerCase()) ?? 0;
              const totalQty = it.quantity + freeQty;
              const fullPence = it.unitPrice * totalQty;
              const paidPence = it.unitPrice * it.quantity;
              const savedPence = it.unitPrice * freeQty;
              const hasSaving = savedPence > 0;

              return (
                <li key={it.id} className={styles.item}>
                  <div className={styles.itemLeft}>
                    <img
                      className={styles.thumb}
                      src={it.imageUrl ?? '/assets/prince-foods-logo.png'}
                      alt={it.name}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className={styles.meta}>
                      <div className={styles.name}>{it.name}</div>
                      {it.sku && <div className={styles.sku}>SKU: {it.sku}</div>}
                      <div className={styles.qty}>
                        {money(order.currency, it.unitPrice)} each ×{totalQty}
                        {hasSaving && (
                          <span style={{ color: '#15803d', marginLeft: 4 }}>
                            ({it.quantity} paid + {freeQty} free)
                          </span>
                        )}
                      </div>
                      {hasSaving && (
                        <div className={styles.itemSaving}>
                          🎁 You saved {money(order.currency, savedPence)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.price}>
                    {hasSaving ? (
                      <div className={styles.priceBlock}>
                        <span className={styles.priceWas}>{money(order.currency, fullPence)}</span>
                        <span className={styles.priceNow}>{money(order.currency, paidPence)}</span>
                      </div>
                    ) : (
                      money(order.currency, it.lineTotal)
                    )}
                  </div>
                </li>
              );
            });
          })()}
        </ul>

        {/* Fix 7: return request button — show for paid/fulfilled orders */}
        {(order.status === 'PAID' || order.status === 'FULFILLED') && (
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0ede6' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 10px' }}>
              Not happy with your order?
            </p>
            <a
              href={`mailto:support@prince-foods.com?subject=Return request — Order %23${order.displayId}&body=Hi, I would like to request a return for order %23${order.displayId}.%0A%0AItems I'd like to return:%0A${order.items.map((i) => `- ${i.name} x${i.quantity}`).join('%0A')}`}
              className={styles.btnGhost}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              Request a return
            </a>
          </div>
        )}
      </section>

      <section className={styles.grid2}>
        {order.shippingAddress && (
          <div className={styles.card}>
            <h2 className={styles.h2}>Delivery address</h2>
            <p className={styles.addr}>
              {
                (
                  order.shippingAddress as {
                    firstName?: string;
                    lastName?: string;
                    line1?: string;
                    line2?: string;
                    town?: string;
                    city?: string;
                    postcode?: string;
                    country?: string;
                    phoneE164?: string;
                  } | null
                )?.firstName
              }{' '}
              {
                (order.shippingAddress as { firstName?: string; lastName?: string } | null)
                  ?.lastName
              }
              <br />
              {(order.shippingAddress as { line1?: string } | null)?.line1}
              {(order.shippingAddress as { line2?: string } | null)?.line2 && (
                <>
                  <br />
                  {(order.shippingAddress as { line2?: string } | null)?.line2}
                </>
              )}
              <br />
              {(
                order.shippingAddress as {
                  town?: string;
                  city?: string;
                  postcode?: string;
                  country?: string;
                } | null
              )?.town
                ? `${(order.shippingAddress as { town?: string } | null)?.town}, `
                : ''}
              {(order.shippingAddress as { city?: string } | null)?.city}
              <br />
              {(order.shippingAddress as { postcode?: string } | null)?.postcode}
              <br />
              {(order.shippingAddress as { country?: string } | null)?.country}
            </p>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.h2}>Summary</h2>
          <div className={styles.kv}>
            <span>Subtotal</span>
            <span>{money(order.currency, order.subtotal)}</span>
          </div>
          <div className={styles.kv}>
            <span>Shipping</span>
            <span>{money(order.currency, order.shippingTotal)}</span>
          </div>
          {(order.discountTotal ?? 0) > 0 && (
            <div className={styles.kv} style={{ color: '#16a34a' }}>
              <span>Offer discount</span>
              <span>-{money(order.currency, order.discountTotal)}</span>
            </div>
          )}
          {(order.taxTotal ?? 0) > 0 && (
            <div className={styles.kv}>
              <span>Tax</span>
              <span>{money(order.currency, order.taxTotal)}</span>
            </div>
          )}
          <div className={styles.total}>
            <span>Total</span>
            <strong>{money(order.currency, order.grandTotal)}</strong>
          </div>

          {(order.discountTotal ?? 0) > 0 && (
            <div className={styles.savingsBanner}>
              🎉 You saved {money(order.currency, order.discountTotal)} on this order
            </div>
          )}

          {order.totalWeightGrams != null && (
            <p className={styles.muted}>
              Package weight: {(order.totalWeightGrams / 1000).toFixed(2)} kg
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
