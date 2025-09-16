// src/lib/modal-close.ts
'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

/**
 * Returns a safe URL to navigate to when closing a modal.
 * Priority:
 *  - ?from=... (set by the link that opened the modal)
 *  - current path (without the modal segment)
 *  - fallback '/'
 */
export function useModalCloseHref(fallback: string = '/') {
  const sp = useSearchParams();
  const pathname = usePathname();
  const from = sp?.get('from');

  return useMemo(() => {
    // If caller provided ?from, trust it.
    if (from && from.startsWith('/')) return from;

    // If the intercepting route is /(.)something, your visible URL is still that “something”.
    // Using pathname as a best-effort fallback keeps you on the current page, but without the modal.
    if (pathname && pathname.startsWith('/')) return pathname;

    return fallback;
  }, [from, pathname, fallback]);
}
