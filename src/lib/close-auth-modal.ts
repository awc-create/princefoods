// src/lib/close-auth-modal.ts
'use client';

import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

/**
 * Remove `modal` and drop `callbackUrl` if it points to the current page or '/'.
 * Uses router.replace() so it doesn't pollute history.
 */
export function closeAuthModal(router: AppRouterInstance, pathname: string, sp: URLSearchParams) {
  const params = new URLSearchParams(sp.toString());
  params.delete('modal');

  const cb = params.get('callbackUrl');
  const decoded = cb ? decodeURIComponent(cb) : null;

  const isSame =
    !decoded ||
    decoded === '/' ||
    decoded === pathname ||
    decoded.replace(/\?.*$/, '') === pathname;

  if (isSame) params.delete('callbackUrl');

  const qs = params.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}
