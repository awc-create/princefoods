// src/lib/email/send-dispatch-email.ts
import nodemailer from 'nodemailer';

interface Args {
  to: string;
  orderId: string;
  orderDisplayId: string;
  carrier: string;
  waybill: string;
  trackingUrl: string;
  labelUrl?: string; // admin-only, optional
}

function mustGetEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function siteBaseUrl() {
  const env =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? process.env.VERCEL_URL ?? '';

  if (!env) return '';

  return env.startsWith('http') ? env.replace(/\/+$/, '') : `https://${env.replace(/\/+$/, '')}`;
}

function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Google Workspace SMTP (recommended):
 * SMTP_HOST=smtp.gmail.com
 * SMTP_PORT=465
 * SMTP_SECURE=true
 * SMTP_USER=your-google-workspace-email
 * SMTP_PASS=app-password
 * SMTP_FROM="Prince Foods <your-google-workspace-email>"
 */
export async function sendDispatchEmail(args: Args) {
  const host = mustGetEnv('SMTP_HOST');
  const port = Number(mustGetEnv('SMTP_PORT'));
  const secure = (process.env.SMTP_SECURE ?? 'true') === 'true';
  const user = mustGetEnv('SMTP_USER');
  const pass = mustGetEnv('SMTP_PASS');
  const from = process.env.SMTP_FROM ?? `Prince Foods <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  const base = siteBaseUrl();

  // ✅ Public tracking page (customer-safe)
  const trackingPageUrl =
    base && args.to
      ? `${base}/orders/${encodeURIComponent(
          args.orderDisplayId
        )}/tracking?email=${encodeURIComponent(args.to)}`
      : '';

  const safeTracking = args.trackingUrl?.trim() || '';
  const safeWaybill = args.waybill?.trim() || '';

  const subject = `Your order is on the way (${args.orderDisplayId})`;

  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.6;">
      <h2 style="margin:0 0 8px;">Your order is on the way 🚚</h2>

      <p style="margin:0 0 14px;">
        Order <strong>#${escapeHtml(args.orderDisplayId)}</strong> has been dispatched.
      </p>

      <div style="padding:14px;border:1px solid #e5e7eb;border-radius:14px;background:#fafafa;">
        <p style="margin:0 0 6px;"><strong>Carrier:</strong> ${escapeHtml(args.carrier)}</p>
        <p style="margin:0 0 6px;"><strong>Tracking number:</strong> ${
          safeWaybill ? escapeHtml(safeWaybill) : '—'
        }</p>

        ${
          safeTracking
            ? `<p style="margin:0;">
                <a href="${safeTracking}" target="_blank" rel="noopener noreferrer">
                  Track with carrier
                </a>
              </p>`
            : `<p style="margin:0;">Tracking link will be available shortly.</p>`
        }
      </div>

      ${
        trackingPageUrl
          ? `
          <div style="margin-top:16px;">
            <a
              href="${trackingPageUrl}"
              style="
                display:inline-block;
                padding:12px 16px;
                border-radius:12px;
                background:#b21e2b;
                color:#ffffff;
                font-weight:700;
                text-decoration:none;
              "
            >
              View your order & tracking
            </a>
          </div>
        `
          : ''
      }

      <p style="margin:18px 0 0;color:#374151;">
        You can view your order status, tracking updates, and shipment history at any time.
      </p>

      <p style="margin:12px 0 0;">Thank you for shopping with Prince Foods.</p>
    </div>
  `;

  const text = [
    `Your order is on the way`,
    `Order: ${args.orderDisplayId}`,
    `Carrier: ${args.carrier}`,
    `Tracking number: ${safeWaybill || '—'}`,
    safeTracking ? `Carrier tracking: ${safeTracking}` : `Tracking link coming soon`,
    trackingPageUrl ? `Order & tracking: ${trackingPageUrl}` : '',
    ``,
    `Thank you for shopping with Prince Foods.`
  ]
    .filter(Boolean)
    .join('\n');

  await transporter.sendMail({
    from,
    to: args.to,
    subject,
    text,
    html
  });
}
