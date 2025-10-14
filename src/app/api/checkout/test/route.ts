// src/app/api/checkout/test/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

type Role = 'HEAD' | 'STAFF' | 'VIEWER';

interface LineIn {
  productId?: string | null;
  sku?: string | null;
  name: string;
  unitPrice: number; // pence
  quantity: number;
  imageUrl?: string | null;
}

interface AddrIn {
  firstName?: string | null;
  lastName?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  postcode: string;
  country: string;
  phoneE164?: string | null;
}

interface PlaceOrderBody {
  items: LineIn[];
  contactEmail: string;
  shippingAddress: AddrIn;
  billingSameAsShipping?: boolean;
  billingAddress?: AddrIn;
  currency?: string;
  notes?: string | null;
  totals?: {
    shipping?: number;
    discount?: number;
    tax?: number;
  };
}

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

const isAddr = (a: unknown): a is AddrIn =>
  !!a &&
  typeof a === 'object' &&
  typeof (a as AddrIn).line1 === 'string' &&
  typeof (a as AddrIn).city === 'string' &&
  typeof (a as AddrIn).postcode === 'string' &&
  typeof (a as AddrIn).country === 'string';

const isLine = (l: unknown): l is LineIn =>
  !!l &&
  typeof l === 'object' &&
  typeof (l as LineIn).name === 'string' &&
  Number.isFinite((l as LineIn).unitPrice) &&
  Number.isFinite((l as LineIn).quantity);

// Short, human-friendly order code (avoids 0/O and 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeDisplayId(len = 8) {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export async function POST(req: NextRequest) {
  // ---------- 1) AuthZ: HEAD/STAFF only ----------
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token?.role ?? 'VIEWER') as Role;
  if (!token || (role !== 'HEAD' && role !== 'STAFF')) {
    return bad('FORBIDDEN', 403);
  }

  // ---------- 2) Parse & validate body ----------
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return bad('INVALID_JSON');
  }

  const body = raw as Partial<PlaceOrderBody>;

  const items = Array.isArray(body.items) ? body.items.filter(isLine) : [];
  const contactEmail = (body.contactEmail ?? '').trim();
  const shipping = body.shippingAddress;
  const billingSame = Boolean(body.billingSameAsShipping);
  const billing = (billingSame ? shipping : body.billingAddress) ?? null;
  const currency = (body.currency ?? 'GBP').toUpperCase();
  const notes = body.notes ?? null;

  if (!items.length) return bad('NO_ITEMS');
  if (!contactEmail) return bad('NO_EMAIL');
  if (!isAddr(shipping)) return bad('INVALID_SHIPPING');
  if (!isAddr(billing)) return bad('INVALID_BILLING');

  // ---------- 3) Recompute totals on server ----------
  const subtotal = items.reduce((sum, it) => {
    const unit = Math.max(0, Math.trunc(it.unitPrice));
    const qty = Math.max(1, Math.trunc(it.quantity));
    return sum + unit * qty;
  }, 0);

  const shippingTotal = Number.isFinite(body.totals?.shipping)
    ? Math.max(0, Math.trunc(body.totals!.shipping!))
    : 0;
  const discountTotal = Number.isFinite(body.totals?.discount)
    ? Math.max(0, Math.trunc(body.totals!.discount!))
    : 0;
  const taxTotal = Number.isFinite(body.totals?.tax)
    ? Math.max(0, Math.trunc(body.totals!.tax!))
    : 0;

  const grandTotal = subtotal + shippingTotal - discountTotal + taxTotal;
  if (grandTotal <= 0) return bad('TOTAL_LEQ_ZERO');

  // ---------- 4) Create order + lines + addresses + test payment ----------
  try {
    // The model requires displayId (unique) — create with collision retries.
    let created: {
      id: string;
      displayId: string;
    } | null = null;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const displayId = makeDisplayId(8);

        created = await prisma.order.create({
          data: {
            displayId, // ✅ REQUIRED by schema
            contactEmail,
            currency,
            status: 'PAID' as OrderStatus, // simulate paid order
            paymentStatus: 'CAPTURED' as PaymentStatus,
            subtotal,
            shippingTotal,
            discountTotal,
            taxTotal,
            grandTotal,
            notes,

            shippingAddress: {
              create: {
                firstName: shipping.firstName ?? null,
                lastName: shipping.lastName ?? null,
                line1: shipping.line1,
                line2: shipping.line2 ?? null,
                city: shipping.city,
                postcode: shipping.postcode,
                country: shipping.country,
                phoneE164: shipping.phoneE164 ?? null,
                kind: 'SHIPPING'
              }
            },
            billingAddress: {
              create: {
                firstName: billing.firstName ?? null,
                lastName: billing.lastName ?? null,
                line1: billing.line1,
                line2: billing.line2 ?? null,
                city: billing.city,
                postcode: billing.postcode,
                country: billing.country,
                phoneE164: billing.phoneE164 ?? null,
                kind: 'BILLING'
              }
            },

            items: {
              create: items.map((it) => ({
                productId: it.productId ?? null,
                sku: it.sku ?? null,
                name: it.name,
                imageUrl: it.imageUrl ?? null,
                unitPrice: Math.trunc(it.unitPrice),
                quantity: Math.max(1, Math.trunc(it.quantity)),
                lineTotal: Math.trunc(it.unitPrice) * Math.max(1, Math.trunc(it.quantity))
              }))
            },

            // Mark clearly as a test provider so the UI can tag it.
            paymentProvider: 'test',
            paymentIntentId: null
          },
          select: { id: true, displayId: true }
        });

        break; // success
      } catch (err) {
        lastErr = err;
        // Retry on unique collision of displayId
        if (
          typeof err === 'object' &&
          err !== null &&
          // Prisma P2002 (unique constraint failed)
          (err as { code?: string }).code === 'P2002' &&
          Array.isArray((err as { meta?: { target?: string[] } }).meta?.target) &&
          (err as { meta?: { target?: string[] } }).meta!.target!.includes('displayId')
        ) {
          continue;
        }
        throw err;
      }
    }

    if (!created) throw lastErr;

    await prisma.payment.create({
      data: {
        orderId: created.id,
        provider: 'test',
        intentId: `test_${created.id}`,
        chargeId: `test_${created.id}_ch`,
        amountPence: grandTotal,
        currency,
        status: 'CAPTURED',
        idempotencyKey: `test-${created.id}`
      }
    });

    return NextResponse.json(
      { ok: true, orderId: created.id, displayId: created.displayId },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message =
      (err as { message?: string })?.message ?? (typeof err === 'string' ? err : 'Unknown error');
    console.error('TEST ORDER CREATE FAILED:', message);
    if (process.env.NODE_ENV !== 'production') {
      return NextResponse.json({ ok: false, error: 'DB_ERROR', detail: message }, { status: 500 });
    }
    return bad('Server error', 500);
  }
}
