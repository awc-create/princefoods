// src/app/api/webhooks/resend/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix'; // npm i svix

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optional: narrow the payload we care about
type ResendEvent =
  | { type: 'email.sent'; data: Record<string, unknown> }
  | { type: 'email.delivered'; data: Record<string, unknown> }
  | { type: 'email.bounced'; data: Record<string, unknown> }
  | { type: 'email.complained'; data: Record<string, unknown> }
  | { type: string; data: Record<string, unknown> }; // fallback

export async function POST(req: NextRequest) {
  try {
    const svixSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!svixSecret) {
      return NextResponse.json(
        { ok: false, error: 'Missing RESEND_WEBHOOK_SECRET' },
        { status: 500 }
      );
    }

    // Get the raw body exactly as received
    const payload = await req.text();

    // Headers come from the NextRequest.headers (a WHATWG Headers)
    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ ok: false, error: 'Missing Svix headers' }, { status: 400 });
    }

    // Verify with Svix
    const wh = new Webhook(svixSecret);
    const evt = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature
    }) as ResendEvent;

    // Handle events (log or persist as needed)
    switch (evt.type) {
      case 'email.sent':
      case 'email.delivered':
      case 'email.bounced':
      case 'email.complained':
        // TODO: persist status if you want to show delivery on the admin timeline
        console.log('[resend]', evt.type, evt.data);
        break;
      default:
        console.log('[resend] other', evt.type);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Resend webhook error:', err);
    return NextResponse.json({ ok: false, error: 'VERIFY_FAILED' }, { status: 400 });
  }
}
