// src/app/mounted-effects.tsx (CLIENT)
'use client';

import { useEffect } from 'react';

export default function MountedEffects() {
  useEffect(() => {
    // Remove the SSR-only "no-transitions" class after first paint
    document.body.classList.remove('no-transitions');
  }, []);

  return null;
}
