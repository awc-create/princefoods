// src/app/account/orders/[displayId]/page.tsx
import { authOptions } from '@/lib/auth-options';
import { urlFrom } from '@/lib/url';
import { getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import styles from './order-detail.module.scss';

export const dynamic = 'force-dynamic';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string | null;
  sku: string | null;
}

interface Address {
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  town: string | null;
  city: string;
  postcode: string;
  country: string;
  phoneE164: string | null;
}

interface ShipmentDTO {
  id: string;
  carrier: string;
  status: string;
  serviceCode: string | null;
  waybill: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  labelMime: string | null;
  // labelBase64 intentionally not exposed here for customer UI
}

interface OrderDTO {
  id: string;
  displayId: string;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  totalWeightGrams: number | null;
  createdAt: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;

  // ✅ add shipments to show tracking
  shipments?: ShipmentDTO[];
}

function money(currency: string, pence: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((pence ?? 0) / 100);
}

function resolveBaseUrl(h: Awaited<ReturnType<typeof headers>>) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase;

  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto') ??
    (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');

  return `${proto}://${host}`;
}

function pickShipments(order: OrderDTO): ShipmentDTO[] {
  const list = Array.isArray(order.shipments) ? order.shipments : [];
  // Put “most useful” first: shipped/ready labels first, newest first
  return list.slice().sort((a, b) => {
    const aT = a.shippedAt ? new Date(a.shippedAt).getTime() : 0;
    const bT = b.shippedAt ? new Date(b.shippedAt).getTime() : 0;
    return bT - aT;
  });
}

export default async function AccountOrderPage({
  params
}: {
  // ✅ Next 15 typing: params can be Promise-like in generated PageProps
  params: Promise<{ displayId: string }>;
}) {
  const { displayId } = await params;

  // defence-in-depth (middleware already blocks, but keep it)
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/?modal=login&next=/account?tab=orders');

  const h = await headers();
  const base = resolveBaseUrl(h);

  const url = urlFrom(`/api/account/orders/${encodeURIComponent(displayId)}`, base);

  const res = await fetch(url, {
    cache: 'no-store',
    headers: { cookie: h.get('cookie') ?? '' }
  });

  if (!res.ok) redirect('/account?tab=orders');

  const json = (await res.json()) as { ok?: boolean; order?: OrderDTO; error?: string };
  const order = json.order;
  if (!order) redirect('/account?tab=orders');

  const shipments = pickShipments(order);

  const primaryTracking =
    shipments.find((s) => s.trackingUrl ?? s.trackingNumber) ?? shipments[0] ?? null;

  return (
    <main className={styles.shell}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.h1}>Order #{order.displayId}</h1>
          <p className={styles.sub}>
            Placed {new Date(order.createdAt).toLocaleString()} • {order.status} •{' '}
            {order.paymentStatus}
          </p>
        </div>

        <Link className={styles.back} href="/account?tab=orders">
          ← Back to orders
        </Link>
      </header>

      {/* ✅ Delivery + Tracking (primary place) */}
      <section className={styles.card}>
        <h2 className={styles.h2}>Delivery & tracking</h2>

        {!shipments.length ? (
          <p className={styles.note}>
            Not dispatched yet. We’ll email tracking once it’s on the way.
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

            {primaryTracking?.trackingUrl ? (
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
            ) : null}

            {shipments.length > 1 ? (
              <div className={styles.shipList}>
                <div className={styles.shipTitle}>Shipments</div>
                <ul className={styles.shipUl}>
                  {shipments.map((s: ShipmentDTO) => (
                    <li key={s.id} className={styles.shipLi}>
                      <div className={styles.shipLeft}>
                        <div className={styles.shipMain}>
                          {s.carrier || 'Carrier'} • {s.status}
                        </div>
                        <div className={styles.shipSub}>
                          {s.trackingNumber || s.waybill ? (
                            <>Tracking: {s.trackingNumber ?? s.waybill}</>
                          ) : (
                            <>Tracking pending</>
                          )}
                          {s.shippedAt ? (
                            <> • Shipped {new Date(s.shippedAt).toLocaleString()}</>
                          ) : null}
                        </div>
                      </div>

                      {s.trackingUrl ? (
                        <a
                          className={styles.shipLink}
                          href={s.trackingUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Track →
                        </a>
                      ) : (
                        <span className={styles.shipLinkMuted}>—</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className={styles.card}>
        <h2 className={styles.h2}>Items</h2>
        <ul className={styles.items}>
          {order.items.map((it: OrderItem) => (
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
                  {!!it.sku && <div className={styles.sku}>SKU: {it.sku}</div>}
                  <div className={styles.qty}>Qty: {it.quantity}</div>
                </div>
              </div>
              <div className={styles.price}>{money(order.currency, it.lineTotal)}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.grid2}>
        <div className={styles.card}>
          <h2 className={styles.h2}>Delivery address</h2>
          <p className={styles.addr}>
            {order.shippingAddress.firstName} {order.shippingAddress.lastName}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? (
              <>
                <br />
                {order.shippingAddress.line2}
              </>
            ) : null}
            <br />
            {order.shippingAddress.town ? `${order.shippingAddress.town}, ` : ''}
            {order.shippingAddress.city}
            <br />
            {order.shippingAddress.postcode}
            <br />
            {order.shippingAddress.country}
            <br />
            {order.shippingAddress.phoneE164 ? `Phone: ${order.shippingAddress.phoneE164}` : null}
          </p>
        </div>

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

          {order.discountTotal > 0 && (
            <div className={styles.kv}>
              <span>Discount</span>
              <span>-{money(order.currency, order.discountTotal)}</span>
            </div>
          )}

          {order.taxTotal > 0 && (
            <div className={styles.kv}>
              <span>Tax</span>
              <span>{money(order.currency, order.taxTotal)}</span>
            </div>
          )}

          <div className={styles.total}>
            <span>Total</span>
            <strong>{money(order.currency, order.grandTotal)}</strong>
          </div>

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
