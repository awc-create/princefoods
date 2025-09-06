// src/app/admin/SetupPush.tsx
'use client';

import { useEffect } from 'react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = typeof window !== 'undefined' ? atob(base64) : '';
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function SetupPush() {
  useEffect(() => {
    (async () => {
      try {
        if (typeof window === 'undefined') return;

        // Require HTTPS in production
        if (location.protocol !== 'https:') return;

        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        // ✅ simplified vapid key lookup
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC ?? process.env.VAPID_PUBLIC;
        if (!vapid) return;

        const reg = await navigator.serviceWorker.register('/sw.js');

        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return;

        let sub = await reg.pushManager.getSubscription();
        // ✅ ESLint-friendly nullish assignment
        sub ??= await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid)
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: sub,
            adminEmail: 'admin@princefoods.com'
          })
        }).catch(() => {});
      } catch {
        // swallow errors in prod/dev
      }
    })();
  }, []);

  return null;
}
