// src/app/api/checkout/place-order/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Human-friendly short code (avoid 0/O/1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode(len = 8) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

// Narrowly type-check Prisma error codes without using `any`
function isPrismaKnownError(e: unknown): e is { code: string; message?: string } {
  return (
    typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).code === 'string'
  );
}
function isUniqueViolation(e: unknown): boolean {
  return isPrismaKnownError(e) && e.code === 'P2002';
}

interface Line {
  id?: string;
  sku?: string | null;
  name: string;
  unitPrice: number; // pence
  quantity: number;
  imageUrl?: string | null;
  productId?: string | null;
  options?: unknown;
}
interface Totals {
  subtotal: number;
  shipping: number;
  discount: number;
  tax: number;
  grandTotal: number;
}
interface AddressDTO {
  firstName?: string;
  lastName?: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
  phoneE164?: string;
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const body = (await req.json()) as {
      items: Line[];
      shippingAddress: AddressDTO;
      billingSameAsShipping?: boolean;
      billingAddress?: AddressDTO;
      totals: Totals;
      currency: string;
      contactEmail?: string;
    };

    // Guards
    if (!body?.items?.length) {
      return NextResponse.json({ error: 'No items in order.' }, { status: 400 });
    }
    const s = body.shippingAddress;
    if (!s?.line1 || !s?.city || !s?.postcode || !s?.country) {
      return NextResponse.json({ error: 'Invalid shipping address.' }, { status: 400 });
    }

    const {
      items,
      shippingAddress,
      billingSameAsShipping = true,
      billingAddress,
      totals,
      currency,
      contactEmail
    } = body;

    const maybeUserId: string | undefined =
      (session?.user as { id?: string } | null)?.id ?? undefined;
    const emailForOrder =
      (contactEmail && contactEmail.trim()) ?? session?.user?.email ?? 'guest@prince-v.com';

    // Snapshot product weights (kg → grams)
    const ids = items.map((i) => i.productId).filter(Boolean) as string[];
    const products =
      ids.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: ids } },
            select: { id: true, weight: true }
          })
        : [];
    const byId = new Map(products.map((p) => [p.id, p.weight]));
    const enriched = items.map((it) => {
      const kg = it.productId ? (byId.get(it.productId) ?? null) : null;
      const unitWeightGrams =
        kg != null && Number.isFinite(kg) ? Math.max(0, Math.round((kg as number) * 1000)) : null;
      return { ...it, unitWeightGrams };
    });
    const totalWeightGrams = enriched.reduce(
      (sum, it) => sum + (it.unitWeightGrams ?? 0) * it.quantity,
      0
    );

    // Addresses
    const createdShipping = await prisma.address.create({
      data: {
        firstName: shippingAddress.firstName ?? undefined,
        lastName: shippingAddress.lastName ?? undefined,
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 ?? undefined,
        city: shippingAddress.city,
        postcode: shippingAddress.postcode,
        country: shippingAddress.country,
        phoneE164: shippingAddress.phoneE164 ?? undefined,
        ...(maybeUserId ? { userId: maybeUserId } : {})
      }
    });
    const createdBilling = billingSameAsShipping
      ? createdShipping
      : await prisma.address.create({
          data: {
            firstName: billingAddress?.firstName ?? undefined,
            lastName: billingAddress?.lastName ?? undefined,
            line1: billingAddress?.line1 ?? shippingAddress.line1,
            line2: billingAddress?.line2 ?? undefined,
            city: billingAddress?.city ?? shippingAddress.city,
            postcode: billingAddress?.postcode ?? shippingAddress.postcode,
            country: billingAddress?.country ?? shippingAddress.country,
            phoneE164: billingAddress?.phoneE164 ?? undefined,
            ...(maybeUserId ? { userId: maybeUserId } : {})
          }
        });

    // Create order WITH displayId; retry if we hit a unique collision
    const MAX_TRIES = 5;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        const displayId = makeCode(8);

        const created = await prisma.order.create({
          data: {
            displayId, // required by your schema/client
            contactEmail: emailForOrder,
            ...(maybeUserId ? { userId: maybeUserId } : {}),
            status: 'PLACED',
            paymentStatus: 'PENDING',
            currency: currency || 'GBP',
            subtotal: totals.subtotal,
            shippingTotal: totals.shipping,
            discountTotal: totals.discount,
            taxTotal: totals.tax,
            grandTotal: totals.grandTotal,
            shippingAddressId: createdShipping.id,
            billingAddressId: createdBilling.id,
            notes: contactEmail && !session?.user?.email ? `Guest checkout` : null,
            totalWeightGrams,
            items: {
              create: enriched.map((it) => ({
                ...(it.productId ? { productId: it.productId } : {}),
                ...(it.sku ? { sku: it.sku } : {}),
                name: it.name,
                ...(it.imageUrl ? { imageUrl: it.imageUrl } : {}),
                unitPrice: it.unitPrice,
                quantity: it.quantity,
                lineTotal: it.unitPrice * it.quantity,
                ...(it.unitWeightGrams != null ? { unitWeightGrams: it.unitWeightGrams } : {}),
                ...(it.options != null ? { options: it.options } : {})
              }))
            }
          },
          select: { id: true, displayId: true }
        });

        // Best-effort analytics
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(
              items
                .filter((it) => it.productId)
                .map((it) => ({
                  type: 'order_line',
                  productId: it.productId!,
                  qty: it.quantity,
                  unitPricePence: it.unitPrice
                }))
            )
          });
        } catch {}

        return NextResponse.json({ ok: true, orderId: created.id, displayId: created.displayId });
      } catch (e) {
        if (isUniqueViolation(e)) {
          // try again with a different short code
          continue;
        }
        console.error('[place-order] create failed:', e);
        throw e;
      }
    }

    return NextResponse.json(
      { error: 'Failed to place order (displayId collisions).' },
      { status: 500 }
    );
  } catch (e) {
    const msg =
      process.env.NODE_ENV !== 'production' && e instanceof Error
        ? e.message
        : 'Failed to place order.';
    console.error('[POST /api/checkout/place-order]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
