// src/app/admin/orders/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import type { Address } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

function formatMoney(pence: number, currency = 'GBP') {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format((pence ?? 0) / 100);
}
const formatKg = (g: number) => `${(g / 1000).toFixed(2)} kg`;

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

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: true,
      items: true,
      payments: true,
      shippingAddress: true,
      billingAddress: true
    }
  });

  if (!order) notFound();

  const currency = order.currency || 'GBP';

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

  // Tag test orders (either explicit provider flag or idempotency markers)
  const isTestOrder =
    order.paymentProvider === 'stripe_test' ||
    order.payments.some((p) => (p.idempotencyKey ?? '').includes('test'));

  // Weight (prefer denormalized, fallback to sum)
  const itemsWeightGrams = order.items.reduce(
    (sum, it) => sum + (it.unitWeightGrams ?? 0) * it.quantity,
    0
  );
  const totalWeightGrams = order.totalWeightGrams ?? itemsWeightGrams;

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <h1 style={{ margin: 0, lineHeight: 1.2, fontWeight: 700 }}>
          Order #{order.displayId ?? order.id}
        </h1>
        <Badge tone={statusTone}>{order.status}</Badge>
        <Badge tone={paymentTone}>Payment: {order.paymentStatus}</Badge>
        {isTestOrder && <Badge tone="muted">Test</Badge>}
      </header>

      <div style={{ color: '#888', marginBottom: 16 }}>
        Placed {order.createdAt.toLocaleString('en-GB')}
        {order.user && (
          <>
            {' '}
            • Customer:{' '}
            <Link href={`/admin/customers?email=${encodeURIComponent(order.contactEmail)}`}>
              {order.user.name || order.contactEmail}
            </Link>
          </>
        )}
        {!order.user && order.contactEmail && <> • Guest: {order.contactEmail}</>}
      </div>

      {/* Totals */}
      <section
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
          marginBottom: 18
        }}
      >
        <Card label="Subtotal" value={formatMoney(order.subtotal, currency)} />
        <Card label="Shipping" value={formatMoney(order.shippingTotal, currency)} />
        {order.discountTotal > 0 && (
          <Card label="Discount" value={`-${formatMoney(order.discountTotal, currency)}`} />
        )}
        {order.taxTotal > 0 && <Card label="Tax" value={formatMoney(order.taxTotal, currency)} />}
        <Card label="Grand total" value={formatMoney(order.grandTotal, currency)} />
        <Card label="Total weight" value={formatKg(totalWeightGrams)} />
      </section>

      {/* Items */}
      <h2 style={{ marginTop: 12, marginBottom: 8 }}>Items</h2>
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>SKU</th>
              <th style={th} title="Unit price">
                Unit
              </th>
              <th style={th}>Qty</th>
              <th style={th}>Weight</th>
              <th style={th}>Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => {
              const lineG = (it.unitWeightGrams ?? 0) * it.quantity;
              return (
                <tr key={it.id} style={{ borderTop: '1px solid #222' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{ position: 'relative', width: 48, height: 48, flex: '0 0 auto' }}
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

      {/* Payments */}
      <h2 style={{ marginTop: 20, marginBottom: 8 }}>Payment(s)</h2>
      {order.payments.length === 0 ? (
        <div style={{ color: '#888' }}>No payments yet.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {order.payments.map((p) => (
            <li key={p.id} style={{ padding: '10px 0', borderBottom: '1px solid #222' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge
                  tone={
                    p.status === 'CAPTURED' ? 'ok' : p.status === 'REFUNDED' ? 'danger' : 'muted'
                  }
                >
                  {p.status}
                </Badge>
                <strong>{formatMoney(p.amountPence, p.currency || currency)}</strong>
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

      {/* Addresses */}
      <h2 style={{ marginTop: 20, marginBottom: 8 }}>Addresses</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 }}>
        <AddrCard title="Shipping" addr={order.shippingAddress} />
        <AddrCard title="Billing" addr={order.billingAddress} />
      </div>

      {/* Meta */}
      <section style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 8 }}>Meta</h3>
        <div style={{ display: 'grid', gap: 8 }}>
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
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #222', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function AddrCard({ title, addr }: { title: string; addr: Address | null }) {
  if (!addr) {
    return (
      <div style={{ border: '1px solid #222', borderRadius: 10, padding: 12 }}>
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
    <div style={{ border: '1px solid #222', borderRadius: 10, padding: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{title}</div>
      {lines.map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  fontWeight: 600,
  borderBottom: '1px solid #333',
  whiteSpace: 'nowrap'
};
const td: React.CSSProperties = {
  padding: '10px 8px',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap'
};
