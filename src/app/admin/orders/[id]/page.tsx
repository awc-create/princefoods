// src/app/admin/orders/[id]/page.tsx
import ApcShipmentCard from '@/components/admin/orders/ApcShipmentCard';
import BuyApcLabelButton from '@/components/admin/orders/BuyApcLabelButton';
import ReturnActionsCard from '@/components/admin/orders/ReturnActionsCard';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import React from 'react';
import ActivityComposer from './ActivityComposer';
import ActivityList from './ActivityList';
import EditEmailInline from './EditEmailInline';
import MoreActions from './MoreActions';
import TagEditor from './TagEditor';
import UndoCancelButton from './UndoCancelButton';

/**
 * ✅ Why the local types?
 * Your TS error: "@prisma/client has no exported member 'Address'"
 * means your generated Prisma Client types are out of sync (or generated differently).
 * To unblock you cleanly (and remove all implicit any errors), we type the shapes we use here.
 */

interface AddressSnapshot {
  firstName: string | null;
  lastName: string | null;
  line1: string;
  line2: string | null;
  city: string;
  town: string | null;
  postcode: string;
  country: string;
  phoneE164: string | null;
}

type OrderStatus = 'DRAFT' | 'PLACED' | 'PAID' | 'FULFILLED' | 'CANCELLED' | 'REFUNDED';
type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'PARTIAL_REFUND'
  | 'REFUNDED'
  | 'FAILED';

interface OrderItemRow {
  id: string;
  name: string;
  sku: string | null;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  unitWeightGrams: number | null;
}

interface PaymentRow {
  id: string;
  provider: string | null;
  intentId: string | null;
  chargeId: string | null;
  refundId: string | null;
  amountPence: number;
  currency: string | null;
  status: PaymentStatus;
  idempotencyKey: string | null;
  createdAt: Date | string;
}

interface UserRow {
  id: string;
  name: string | null;
}

interface ActivityRow {
  id: string;
  orderId: string;
  type: string;
  note: string | null;
  createdAt: Date | string;
}

interface TagRow {
  slug: string;
  label: string;
  color: string | null;
}

interface OrderTagRow {
  tag: TagRow;
}

interface PromotionRow {
  id: string;
  code: string;
  name: string | null;
  status: string;
}

interface OrderOfferRow {
  id: string;
  offerId: string;
  offerName: string;
  offerKind: string | null;
  discountPence: number;
  meta: unknown;
  appliedAt: Date | string;
}

interface OrderWithRels {
  id: string;
  displayId: string | null;
  createdAt: Date;
  archivedAt: Date | null;

  user: UserRow | null;
  contactEmail: string;

  status: OrderStatus;
  paymentStatus: PaymentStatus;

  currency: string | null;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;

  totalWeightGrams: number | null;

  shippingAddress: AddressSnapshot | null;
  billingAddress: AddressSnapshot | null;

  paymentProvider: string | null;
  paymentIntentId: string | null;

  notes: string | null;

  refundTotal: number | null;

  editableUntil: Date | null;
  cancelReversibleUntil: Date | null;

  // ✅ promo fields on Order
  promotionCode: string | null;
  promotion: PromotionRow | null;

  payments: PaymentRow[];
  items: OrderItemRow[];
  orderOffers: OrderOfferRow[];
}

function formatMoney(pence: number, currency = 'GBP') {
  const v = Number.isFinite(pence) ? pence : 0;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(v / 100);
}

const formatKg = (g: number) => `${(g / 1000).toFixed(2)} kg`;

/** ✅ Offer meta parsing (removes all `any`) */
interface AutoAddMetaItem {
  name: string;
  qty: number;
}
interface OfferMeta {
  autoAdd?: AutoAddMetaItem[];
}

function parseOfferMeta(meta: unknown): OfferMeta {
  if (!meta || typeof meta !== 'object') return {};

  const m = meta as Record<string, unknown>;
  const raw = m.autoAdd;

  if (!Array.isArray(raw)) return {};

  const cleaned: AutoAddMetaItem[] = raw
    .map((it) => {
      if (!it || typeof it !== 'object') return null;
      const o = it as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name : null;
      const qty = typeof o.qty === 'number' ? o.qty : null;
      if (!name || qty === null) return null;
      return { name, qty };
    })
    .filter((x): x is AutoAddMetaItem => Boolean(x));

  return cleaned.length ? { autoAdd: cleaned } : {};
}

function Badge({
  children,
  tone = 'default'
}: {
  children: React.ReactNode;
  tone?: 'default' | 'ok' | 'warn' | 'danger' | 'muted';
}) {
  const colors: Record<'default' | 'ok' | 'warn' | 'danger' | 'muted', React.CSSProperties> = {
    default: { background: '#2a2a2a', color: '#fff' },
    ok: { background: '#174e2e', color: '#d6ffdf' },
    warn: { background: '#5a4a17', color: '#fff1b3' },
    danger: { background: '#5a1717', color: '#ffd6d6' },
    muted: { background: '#2a2a2a', color: '#bbb' }
  };

  return (
    <span
      style={{
        ...colors[tone],
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 12,
        lineHeight: 1
      }}
    >
      {children}
    </span>
  );
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) notFound();

  const [orderRaw, activitiesRaw, orderTagRowsRaw] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: true,
        payments: true,
        shippingAddress: true,
        billingAddress: true,

        // ✅ include promo info (select only needed fields)
        promotion: { select: { id: true, code: true, name: true, status: true } },

        // ✅ offers audit
        orderOffers: {
          orderBy: { appliedAt: 'asc' },
          select: {
            id: true,
            offerId: true,
            offerName: true,
            offerKind: true,
            discountPence: true,
            meta: true,
            appliedAt: true
          }
        }
      }
    }),
    prisma.orderActivity.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' }
    }),
    prisma.orderTag.findMany({
      where: { orderId: id },
      include: { tag: true },
      orderBy: { assignedAt: 'asc' }
    })
  ]);

  const order = (orderRaw as unknown as OrderWithRels | null) ?? null;
  const activities = (activitiesRaw as unknown as ActivityRow[]) ?? [];
  const orderTagRows = (orderTagRowsRaw as unknown as OrderTagRow[]) ?? [];

  if (!order) notFound();

  const currency = order.currency ?? 'GBP';
  const tags = orderTagRows.map((r: OrderTagRow) => r.tag);

  const statusTone =
    order.status === 'FULFILLED'
      ? 'ok'
      : order.status === 'CANCELLED' || order.status === 'REFUNDED'
        ? 'danger'
        : order.status === 'PAID'
          ? 'ok'
          : order.status === 'PLACED'
            ? 'warn'
            : 'muted';

  const paymentTone =
    order.paymentStatus === 'CAPTURED'
      ? 'ok'
      : order.paymentStatus === 'REFUNDED' || order.paymentStatus === 'FAILED'
        ? 'danger'
        : order.paymentStatus === 'AUTHORIZED'
          ? 'warn'
          : 'muted';

  const isTestOrder =
    order.paymentProvider === 'stripe_test' ||
    order.payments.some((p: PaymentRow) => (p.idempotencyKey ?? '').includes('test'));

  const itemsWeightGrams = order.items.reduce((sum: number, it: OrderItemRow) => {
    return sum + (it.unitWeightGrams ?? 0) * it.quantity;
  }, 0);

  const totalWeightGrams = order.totalWeightGrams ?? itemsWeightGrams;

  const hasStripeCapture = order.payments.some(
    (p: PaymentRow) => p.status === 'CAPTURED' && (p.provider ?? '').includes('stripe')
  );

  const refundableRemainingPence = Math.max(
    0,
    (order.grandTotal ?? 0) -
      (Number.isFinite(order.refundTotal as number) ? (order.refundTotal as number) : 0)
  );

  const now = new Date();
  const reversibleUntilRaw = order.cancelReversibleUntil ?? order.editableUntil;
  const reversibleUntil = reversibleUntilRaw ? new Date(reversibleUntilRaw) : null;
  const isReversible = Boolean(reversibleUntil && reversibleUntil.getTime() > now.getTime());
  const minutesLeft = isReversible
    ? Math.max(0, Math.round((reversibleUntil!.getTime() - now.getTime()) / 60000))
    : 0;

  const isArchived = Boolean(order.archivedAt);

  const promoLabel = order.promotion
    ? `${order.promotion.code}${order.promotion.name ? ` — ${order.promotion.name}` : ''}`
    : (order.promotionCode ?? null);

  const deliveryPreview = order.shippingAddress
    ? {
        name:
          [order.shippingAddress.firstName ?? '', order.shippingAddress.lastName ?? '']
            .filter(Boolean)
            .join(' ')
            .trim() || 'Customer',
        phone: order.shippingAddress.phoneE164 ?? null,
        email: order.contactEmail ?? null,
        address1: order.shippingAddress.line1 ?? '',
        address2: order.shippingAddress.line2 ?? '',
        city: order.shippingAddress.city ?? '',
        postcode: order.shippingAddress.postcode ?? '',
        countryCode: (order.shippingAddress.country ?? 'GB').toUpperCase()
      }
    : null;

  return (
    <div style={{ padding: 24, display: 'grid', gap: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, lineHeight: 1.2, fontWeight: 700 }}>
          Order #{order.displayId ?? order.id}
        </h1>
        <Badge tone={statusTone}>{order.status}</Badge>
        <Badge tone={paymentTone}>Payment: {order.paymentStatus}</Badge>
        {isArchived && <Badge tone="muted">Archived</Badge>}
        {isTestOrder && <Badge tone="muted">Test</Badge>}
      </header>

      <div style={{ color: '#888' }}>
        Placed {new Date(order.createdAt).toLocaleString('en-GB')}
        {order.user ? (
          <>
            {' '}
            • Customer:{' '}
            <Link href={`/admin/customers/${order.user.id}`}>
              {order.user.name ?? order.contactEmail}
            </Link>
          </>
        ) : (
          order.contactEmail && <> • Guest: {order.contactEmail}</>
        )}
        {isArchived && order.archivedAt && (
          <>
            {' '}
            • <span title="This order is archived">Archived:</span>{' '}
            {new Date(order.archivedAt).toLocaleString('en-GB')}
          </>
        )}
      </div>

      {reversibleUntil && (
        <div
          style={{
            padding: '8px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            background: isReversible ? '#fff8e1' : '#f6f7f9',
            color: isReversible ? '#5a4a17' : '#666',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: 'space-between'
          }}
        >
          <div>
            {isReversible ? (
              <>
                <strong>Reversible until:</strong> {reversibleUntil.toLocaleString('en-GB')} (
                {minutesLeft} min left)
              </>
            ) : (
              <>
                <strong>Reversal window ended:</strong> {reversibleUntil.toLocaleString('en-GB')}
              </>
            )}
          </div>

          {isReversible && order.status === 'CANCELLED' && (order.refundTotal ?? 0) === 0 && (
            <UndoCancelButton
              orderId={order.id}
              untilISO={reversibleUntil.toISOString()}
              disabled={false}
            />
          )}
        </div>
      )}

      {/* Flags for CancelDialog */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.__order_isTest = ${JSON.stringify(isTestOrder)};
            window.__order_hasStripeCapture = ${JSON.stringify(hasStripeCapture)};
            window.__order_refundableRemainingPence = ${JSON.stringify(refundableRemainingPence)};
          `
        }}
      />

      {/* ✅ Buttons: LIVE + TEST (no switcher) */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <MoreActions
          orderId={order.id}
          contactEmail={order.contactEmail}
          canFulfill={
            order.status !== 'FULFILLED' &&
            order.status !== 'CANCELLED' &&
            order.status !== 'REFUNDED'
          }
        />

        <BuyApcLabelButton
          mode="live"
          orderId={order.id}
          weightGrams={totalWeightGrams || undefined}
          deliveryPreview={deliveryPreview}
        />

        <BuyApcLabelButton
          mode="test"
          orderId={order.id}
          weightGrams={totalWeightGrams || undefined}
          deliveryPreview={deliveryPreview}
        />
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        {/* Left column */}
        <div style={{ display: 'grid', gap: 12 }}>
          <section
            style={{
              display: 'grid',
              gap: 10,
              gridTemplateColumns: 'repeat(4, minmax(0,1fr))'
            }}
          >
            <Card label="Subtotal" value={formatMoney(order.subtotal, currency)} />
            <Card label="Shipping" value={formatMoney(order.shippingTotal, currency)} />
            {order.discountTotal > 0 && (
              <Card label="Discount" value={`-${formatMoney(order.discountTotal, currency)}`} />
            )}
            {order.taxTotal > 0 && (
              <Card label="Tax" value={formatMoney(order.taxTotal, currency)} />
            )}
            <Card label="Grand total" value={formatMoney(order.grandTotal, currency)} />
            <Card label="Total weight" value={formatKg(totalWeightGrams)} />

            {promoLabel && <Card label="Promotion" value={promoLabel} />}
            {order.orderOffers.length > 0 && (
              <Card label="Offers" value={`${order.orderOffers.length} used`} />
            )}
          </section>

          <section>
            <h2 style={{ margin: '6px 0' }}>Items</h2>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr>
                    <th style={th}>Product</th>
                    <th style={th}>SKU</th>
                    <th style={th}>Unit</th>
                    <th style={th}>Qty</th>
                    <th style={th}>Weight</th>
                    <th style={th}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it: OrderItemRow) => {
                    const lineG = (it.unitWeightGrams ?? 0) * it.quantity;
                    return (
                      <tr key={it.id} style={{ borderTop: '1px solid #222' }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                position: 'relative',
                                width: 48,
                                height: 48,
                                flex: '0 0 auto'
                              }}
                            >
                              <Image
                                src={it.imageUrl ?? '/assets/prince-foods-logo.png'}
                                alt=""
                                fill
                                sizes="48px"
                                style={{ objectFit: 'contain' }}
                              />
                            </div>
                            <div>{it.name}</div>
                          </div>
                        </td>
                        <td style={td}>{it.sku ?? '—'}</td>
                        <td style={td}>{formatMoney(it.unitPrice, currency)}</td>
                        <td style={td}>{it.quantity}</td>
                        <td style={td}>{lineG ? formatKg(lineG) : '—'}</td>
                        <td style={td}>{formatMoney(it.lineTotal, currency)}</td>
                      </tr>
                    );
                  })}
                  {order.items.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ ...td, color: '#888' }}>
                        No items on this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 style={{ margin: '6px 0' }}>Payment(s)</h2>
            {order.payments.length === 0 ? (
              <div style={{ color: '#888' }}>No payments yet.</div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {order.payments.map((p: PaymentRow) => (
                  <li key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #222' }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
                    >
                      <Badge
                        tone={
                          p.status === 'CAPTURED'
                            ? 'ok'
                            : p.status === 'REFUNDED'
                              ? 'danger'
                              : 'muted'
                        }
                      >
                        {p.status}
                      </Badge>
                      <strong>{formatMoney(p.amountPence, p.currency ?? currency)}</strong>
                      <span style={{ color: '#888' }}>
                        {new Date(p.createdAt).toLocaleString('en-GB')}
                      </span>
                    </div>
                    <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>
                      provider: {p.provider ?? '—'} • intent: {p.intentId ?? '—'} • charge:{' '}
                      {p.chargeId ?? '—'} • refund: {p.refundId ?? '—'}
                      {p.idempotencyKey ? <> • key: {p.idempotencyKey}</> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {order.orderOffers.length > 0 && (
            <section>
              <h2 style={{ margin: '6px 0' }}>Offers</h2>

              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Offer</th>
                      <th style={th}>Discount</th>
                      <th style={th}>Free items / notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.orderOffers.map((o: OrderOfferRow) => {
                      const meta = parseOfferMeta(o.meta);
                      const autoAdd = meta.autoAdd ?? [];
                      const freeTxt =
                        autoAdd.length > 0
                          ? autoAdd.map((x) => `${x.name} ×${x.qty}`).join(', ')
                          : '—';

                      return (
                        <tr key={o.id} style={{ borderTop: '1px solid #222' }}>
                          <td style={td}>{new Date(o.appliedAt).toLocaleString('en-GB')}</td>
                          <td style={td}>
                            {o.offerName}
                            {o.offerKind ? (
                              <span style={{ opacity: 0.7 }}> ({o.offerKind})</span>
                            ) : null}
                          </td>
                          <td style={td}>{formatMoney(o.discountPence, currency)}</td>
                          <td style={td}>{freeTxt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h3 style={{ marginBottom: 6 }}>Activity</h3>

            <ActivityList
              orderId={order.id}
              initial={activities.map((a: ActivityRow) => ({
                id: a.id,
                orderId: a.orderId,
                type: a.type,
                note: a.note,
                createdAt:
                  a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt)
              }))}
            />

            <ActivityComposer orderId={order.id} />
          </section>
        </div>

        {/* Right sidebar */}
        <aside style={{ display: 'grid', gap: 10 }}>
          <style>
            {`
              aside section { margin: 0 !important; }
              aside h2, aside h3 { margin: 0 0 4px 0 !important; }
            `}
          </style>

          <section>
            <h2>Customer</h2>
            <div
              style={{
                border: '1px solid #222',
                borderRadius: 10,
                padding: 10,
                display: 'grid',
                gap: 8
              }}
            >
              {order.user ? (
                <div style={{ display: 'grid', gap: 2 }}>
                  <strong style={{ lineHeight: 1.2 }}>{order.user.name ?? 'Customer'}</strong>
                  <div style={{ color: '#666', fontSize: 13 }}>
                    <Link
                      href={`/admin/customers/${order.user.id}`}
                      style={{ color: '#007bff', textDecoration: 'none' }}
                    >
                      Open customer page →
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#666' }}>Guest order</div>
              )}

              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ color: '#888', fontSize: 12, fontWeight: 600 }}>
                  Order contact email
                </div>
                <EditEmailInline orderId={order.id} initial={order.contactEmail} />
              </div>
            </div>
          </section>

          <section>
            <h3>Meta</h3>
            <div
              style={{
                display: 'grid',
                gap: 6,
                border: '1px solid #222',
                borderRadius: 10,
                padding: 10
              }}
            >
              <div>
                <span style={{ color: '#888' }}>Payment provider:&nbsp;</span>
                <span>{order.paymentProvider ?? '—'}</span>
              </div>
              <div>
                <span style={{ color: '#888' }}>Payment intent:&nbsp;</span>
                <span>{order.paymentIntentId ?? '—'}</span>
              </div>
              {order.notes && (
                <div>
                  <span style={{ color: '#888' }}>Notes:&nbsp;</span>
                  <span>{order.notes}</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <ApcShipmentCard orderId={order.id} />
          </section>

          <section>
            <ReturnActionsCard orderId={order.id} />
          </section>

          <section>
            <h2>Addresses</h2>
            <div style={{ display: 'grid', gap: 6 }}>
              <AddrCard title="Shipping" addr={order.shippingAddress} />
              <AddrCard title="Billing" addr={order.billingAddress} />
            </div>
          </section>

          <section>
            <h3>Tags</h3>
            <TagEditor
              orderId={order.id}
              initial={tags.map((t: TagRow) => ({
                slug: t.slug,
                label: t.label,
                color: t.color ?? undefined
              }))}
            />
          </section>
        </aside>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #222', borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function AddrCard({ title, addr }: { title: string; addr: AddressSnapshot | null }) {
  if (!addr) {
    return (
      <div style={{ border: '1px solid #222', borderRadius: 10, padding: 10 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
        <div style={{ color: '#888' }}>—</div>
      </div>
    );
  }

  const lines = [
    [addr.firstName ?? '', addr.lastName ?? ''].filter(Boolean).join(' ').trim(),
    addr.line1,
    addr.line2 ?? '',
    [addr.city ?? '', addr.postcode ?? ''].filter(Boolean).join(' ').trim(),
    addr.country,
    addr.phoneE164 ? `☎ ${addr.phoneE164}` : ''
  ].filter(Boolean) as string[];

  return (
    <div style={{ border: '1px solid #222', borderRadius: 10, padding: 10 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 8px',
  fontWeight: 600,
  borderBottom: '1px solid #333',
  whiteSpace: 'nowrap'
};

const td: React.CSSProperties = {
  padding: '8px 8px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
};
