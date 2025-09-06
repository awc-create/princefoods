// src/lib/push.ts
import webpush, { type PushSubscription, type WebPushError } from 'web-push';
import { prisma } from './prisma';

// Accept either NEXT_PUBLIC_VAPID_PUBLIC (preferred) or VAPID_PUBLIC as an alias
const VAPID_PUBLIC = (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC ??
  process.env.VAPID_PUBLIC ??
  ''
).trim();
const VAPID_PRIVATE = (process.env.VAPID_PRIVATE ?? '').trim();

const hasVapid = VAPID_PUBLIC !== '' && VAPID_PRIVATE !== '';

if (hasVapid) {
  webpush.setVapidDetails('mailto:alerts@prince-foods.com', VAPID_PUBLIC, VAPID_PRIVATE);
} else if (process.env.NODE_ENV !== 'production') {
  // Only warn in dev to avoid build logs being noisy
  console.warn('[push] VAPID keys missing; admin push notifications are disabled.');
}

/**
 * Sends a Web Push notification to all admin subscriptions.
 * Auto-cleans dead subscriptions (410/404).
 */
export async function sendAdminPush(title: string, body: string): Promise<void> {
  if (!hasVapid) return;

  const subs = await prisma.pushSubscription.findMany({
    select: { id: true, endpointJson: true }
  });
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body });
  const toDelete: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        const subscription = JSON.parse(s.endpointJson) as PushSubscription;
        await webpush.sendNotification(subscription, payload);
      } catch (err: unknown) {
        const code = (err as WebPushError)?.statusCode;
        if (code === 404 || code === 410) {
          toDelete.push(s.id); // stale subscription
        } else {
          console.error('[push] send error:', err instanceof Error ? err.message : String(err));
        }
      }
    })
  );

  if (toDelete.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: toDelete } } });
  }
}
