import webpush, { type WebPushError, type PushSubscription } from 'web-push';
import { prisma } from './prisma';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails('mailto:alerts@prince-foods.com', VAPID_PUBLIC, VAPID_PRIVATE);
} else {
   
  console.warn('[push] VAPID keys missing; admin push notifications are disabled.');
}

/**
 * Sends a Web Push notification to all admin subscriptions.
 * Auto-cleans dead subscriptions (410/404).
 */
export async function sendAdminPush(title: string, body: string): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  const subs = await prisma.pushSubscription.findMany({
    select: { id: true, endpointJson: true },
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
