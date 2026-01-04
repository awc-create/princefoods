// src/lib/email.tsx
import ApcLabelReadyEmail from '@/emails/ApcLabelReadyEmail';
import ChatSLAEmail from '@/emails/ChatSLAEmail';
import TrackingEmail from '@/emails/TrackingEmail';
import WelcomeEmail from '@/emails/WelcomeEmail';
import { renderAsync } from '@react-email/render';
import { getResendOrThrow } from './resend';

const FROM = process.env.EMAIL_FROM ?? 'Prince Foods <support@prince-foods.com>';
const DEFAULT_TO = process.env.SUPPORT_EMAIL ?? 'support@prince-foods.com';

const SITE_BASE_RAW =
  process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? 'https://www.prince-foods.com';
const SITE_BASE = SITE_BASE_RAW.replace(/\/$/, '');

const LOGO_URL = `${SITE_BASE}/assets/logo/logo-full.png`;

export interface CategoryTeaser {
  title: string;
  href: string;
  image: string;
}
export interface ProductTeaser {
  id: string;
  title: string;
  href: string;
  image: string;
  price?: number | null;
}

/** SLA Email */
export async function sendSlaEmailTemplate(params: {
  threadId: string;
  preview: string;
  adminUrl: string;
  minutesOverdue: number;
  to?: string | string[];
}) {
  const html = await renderAsync(
    <ChatSLAEmail
      threadId={params.threadId}
      preview={params.preview}
      adminUrl={params.adminUrl}
      minutesOverdue={params.minutesOverdue}
      brand={{
        primary: '#D62828',
        logoUrl: LOGO_URL,
        supportEmail: DEFAULT_TO
      }}
    />
  );

  const to = Array.isArray(params.to) ? params.to : [params.to ?? DEFAULT_TO];
  const resend = getResendOrThrow();

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Chat SLA breached • ${params.threadId}`,
    html,
    replyTo: process.env.REPLY_TO ?? DEFAULT_TO,
    tags: [{ name: 'category', value: 'chat-sla' }]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** Welcome Email */
export async function sendWelcomeEmail(params: { to: string; name?: string }) {
  const html = await renderAsync(<WelcomeEmail name={params.name} siteUrl={SITE_BASE} />);

  const resend = getResendOrThrow();
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Welcome to Prince Foods',
    html,
    replyTo: process.env.REPLY_TO ?? process.env.SUPPORT_EMAIL ?? undefined,
    tags: [{ name: 'category', value: 'welcome' }]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** Welcome Verify Email */
export async function sendWelcomeVerifyEmail(params: {
  to: string;
  name?: string;
  code: string;
  verifyUrl: string;
  expiresInMinutes?: number;
  categories?: CategoryTeaser[];
  bestSellers?: ProductTeaser[];
}) {
  const html = await renderAsync(
    <WelcomeEmail
      name={params.name}
      siteUrl={SITE_BASE}
      verificationCode={params.code}
      verifyUrl={params.verifyUrl}
      expiresInMinutes={params.expiresInMinutes ?? 15}
      categories={params.categories}
      bestSellers={params.bestSellers}
    />
  );

  const resend = getResendOrThrow();
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: 'Verify your Prince Foods account',
    html,
    replyTo: process.env.REPLY_TO ?? process.env.SUPPORT_EMAIL ?? undefined,
    tags: [{ name: 'category', value: 'welcome-verify' }]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** Shipment / tracking email */
export async function sendTrackingEmail(params: {
  to: string;
  orderId: string;
  displayId?: string | null;
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  products?: ProductTeaser[];
}) {
  const { to, orderId, displayId, carrier, trackingNumber, trackingUrl, products = [] } = params;

  const html = await renderAsync(
    <TrackingEmail
      orderId={orderId}
      displayId={displayId}
      carrier={carrier}
      trackingNumber={trackingNumber}
      trackingUrl={trackingUrl}
      products={products}
      brand={{
        logoUrl: LOGO_URL,
        primary: '#D62828',
        supportEmail: DEFAULT_TO,
        siteUrl: SITE_BASE
      }}
    />
  );

  const resend = getResendOrThrow();
  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Your Prince Foods order ${displayId ?? orderId} is on its way`,
    html,
    replyTo: process.env.REPLY_TO ?? DEFAULT_TO,
    tags: [
      { name: 'orderId', value: orderId },
      { name: 'kind', value: 'tracking' }
    ]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** APC label ready email (admin notification) */
export async function sendApcLabelReadyEmail(params: {
  to: string | string[];
  orderId: string;
  displayId?: string | null;
  waybill: string;
  productCode?: string | null;
  trackingUrl?: string | null;
}) {
  const recipients = Array.isArray(params.to) ? params.to : [params.to];

  const html = await renderAsync(
    <ApcLabelReadyEmail
      siteUrl={SITE_BASE}
      orderId={params.orderId}
      displayId={params.displayId}
      waybill={params.waybill}
      productCode={params.productCode ?? null}
      trackingUrl={params.trackingUrl ?? null}
    />
  );

  const resend = getResendOrThrow();
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: recipients,
    subject: `APC label ready • ${params.displayId ?? params.orderId}`,
    html,
    replyTo: process.env.REPLY_TO ?? DEFAULT_TO,
    tags: [
      { name: 'category', value: 'apc-label-ready' },
      { name: 'orderId', value: params.orderId }
    ]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** Order cancelled email */
export async function sendOrderCancelledEmail(params: {
  to: string;
  orderId: string;
  displayId?: string | null;
  reason?: string | null;
}) {
  const html = `
  <div style="font-family: system-ui, sans-serif; line-height:1.5; color:#111">
    <h2 style="margin:0 0 12px">Your order ${params.displayId ?? params.orderId} was cancelled</h2>
    ${params.reason ? `<p>Reason: ${params.reason}</p>` : ''}
    <p style="margin:12px 0 0">If this was unexpected, please contact <a href="mailto:${DEFAULT_TO}">${DEFAULT_TO}</a>.</p>
  </div>`;

  const resend = getResendOrThrow();
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Order ${params.displayId ?? params.orderId} cancelled`,
    html,
    replyTo: DEFAULT_TO,
    tags: [{ name: 'category', value: 'order-cancelled' }]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** Refund issued email */
export async function sendRefundEmail(params: {
  to: string;
  orderId: string;
  displayId?: string | null;
  amountPence: number;
}) {
  const amount = `£${(params.amountPence / 100).toFixed(2)}`;
  const html = `
  <div style="font-family: system-ui, sans-serif; line-height:1.5; color:#111">
    <h2>Your refund has been issued</h2>
    <p>Order: <strong>${params.displayId ?? params.orderId}</strong></p>
    <p>Amount: <strong>${amount}</strong></p>
    <p style="margin-top:12px;color:#555">It may take a few days to appear on your statement.</p>
  </div>`;

  const resend = getResendOrThrow();
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: `Refund for order ${params.displayId ?? params.orderId}`,
    html,
    replyTo: DEFAULT_TO,
    tags: [{ name: 'category', value: 'refund' }]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}

/** Contact email changed notice */
export async function sendEmailChangedNotice(params: {
  oldEmail?: string | null;
  newEmail: string;
  orderId: string;
  displayId?: string | null;
}) {
  const html = `
  <div style="font-family: system-ui, sans-serif; line-height:1.5; color:#111">
    <h2>Your contact email was updated</h2>
    <p>Order: <strong>${params.displayId ?? params.orderId}</strong></p>
    ${params.oldEmail ? `<p>Previous: ${params.oldEmail}</p>` : ''}
    <p>New: <strong>${params.newEmail}</strong></p>
    <p style="margin-top:12px;color:#555">If you did not request this, please reply immediately.</p>
  </div>`;

  const resend = getResendOrThrow();
  const recipients = [params.newEmail];
  if (params.oldEmail && params.oldEmail !== params.newEmail) recipients.push(params.oldEmail);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to: recipients,
    subject: `Email changed for order ${params.displayId ?? params.orderId}`,
    html,
    replyTo: DEFAULT_TO,
    tags: [{ name: 'category', value: 'order-email-changed' }]
  });

  if (error) throw error;
  return { id: data?.id ?? null };
}
