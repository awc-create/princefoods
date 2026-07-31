'use client';

import { useEffect, useState } from 'react';

/** Returns `value` after it has stopped changing for `delayMs` (default 300). */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

export default useDebouncedValue;
