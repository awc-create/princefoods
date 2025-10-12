// src/app/api/orders/route.ts
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

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
      contactEmail?: string; // <-- may be absent for guest flow
    };

    // Basic guards
    if (!body?.items?.length) {
      return NextResponse.json({ error: 'No items in order.' }, { status: 400 });
    }
    if (
      !body?.shippingAddress?.line1 ||
      !body?.shippingAddress?.city ||
      !body?.shippingAddress?.postcode ||
      !body?.shippingAddress?.country
    ) {
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

    // If your schema has userId optional, this is fine. If it's required, you must migrate it or use a real user.
    const userId: string | undefined = (session?.user as { id?: string } | null)?.id ?? undefined;

    // Decide what email to store on the order (schema currently REQUIRES contactEmail)
    const emailForOrder =
      (contactEmail && contactEmail.trim()) ?? session?.user?.email ?? 'guest@prince-v.com';

    // Create addresses (no `kind` field in this no-migration variant)
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
        userId
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
            userId
          }
        });

    // Create order — now INCLUDING contactEmail to satisfy current Prisma types
    const order = await prisma.order.create({
      data: {
        userId, // ok if optional in schema; otherwise migrate to optional for guests
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
        contactEmail: emailForOrder, // <-- required by your current client
        notes: contactEmail && !session?.user?.email ? `Guest checkout` : null,
        items: {
          create: items.map((it) => ({
            productId: it.productId ?? undefined,
            sku: it.sku ?? undefined,
            name: it.name,
            imageUrl: it.imageUrl ?? undefined,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            lineTotal: it.unitPrice * it.quantity,
            options: it.options ?? undefined
          }))
        }
      },
      select: { id: true }
    });

    // 🔹 Fire analytics for each order line (product sales + revenue)
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
              unitPricePence: it.unitPrice // already pence
            }))
        )
      });
    } catch {}

    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to place order.' }, { status: 500 });
  }
}
