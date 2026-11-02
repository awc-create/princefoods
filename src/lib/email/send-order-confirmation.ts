// src/lib/email/send-order-confirmation.ts
/**
 * Sends the order confirmation email.
 *
 * Extracted from the Stripe webhook so that FREE orders can use it too.
 * A fully-discounted order (grandTotal <= 0) is marked PAID in place-order
 * without ever creating a Stripe session — so no webhook fires, and before this
 * the customer received nothing at all.
 *
 * Never throws: a mail failure must not roll back a paid order.
 */
import { prisma } from '@/lib/prisma';

/** Marker note used both for the audit trail and as the idempotency key. */
const SENT_NOTE = 'Order confirmation email sent';

export async function sendOrderConfirmationEmail(orderId: string): Promise<void> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? 'Prince Foods <no-reply@prince-foods.com>';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? 'https://www.prince-foods.com';

  if (!key) return;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        displayId: true,
        createdAt: true,
        contactEmail: true,
        currency: true,
        subtotal: true,
        shippingTotal: true,
        discountTotal: true,
        grandTotal: true,
        items: { select: { name: true, sku: true, quantity: true, lineTotal: true } }
      }
    });

    if (!order?.contactEmail) return;

    // Idempotency: Stripe can deliver the same event more than once, and a free
    // order could be reprocessed. We already write an activity note on success,
    // so use that as the "already sent" marker — no extra column needed.
    const alreadySent = await prisma.orderActivity.findFirst({
      where: { orderId, type: 'NOTE', note: SENT_NOTE },
      select: { id: true }
    });
    if (alreadySent) return;

    const { Resend } = await import('resend');
    const { render } = await import('@react-email/render');
    const { default: OrderConfirmationEmail } = await import('@/emails/OrderConfirmationEmail');

    const ref = order.displayId ?? order.id.slice(-8).toUpperCase();

    const html = await render(
      OrderConfirmationEmail({
        displayId: ref,
        createdAt: new Date(order.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
        items: order.items,
        subtotal: order.subtotal ?? 0,
        shippingTotal: order.shippingTotal ?? 0,
        discountTotal: order.discountTotal ?? 0,
        grandTotal: order.grandTotal ?? 0,
        currency: order.currency ?? 'GBP',
        brand: { siteUrl }
      })
    );

    const resend = new Resend(key);
    await resend.emails.send({
      from,
      to: order.contactEmail,
      subject: `Order confirmed — #${ref}`,
      html
    });

    // Written unconditionally (not just via the caller's logger) because this
    // note is what makes the send idempotent.
    await prisma.orderActivity.create({
      data: { orderId, type: 'NOTE', note: SENT_NOTE }
    });
  } catch (e) {
    // Never fail the caller (webhook or checkout) because email failed.
    console.error('[sendOrderConfirmationEmail]', e);
  }
}
