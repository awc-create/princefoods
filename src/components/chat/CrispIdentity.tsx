// src/components/chat/CrispIdentity.tsx
'use client';

import { useEffect } from 'react';

export default function CrispIdentity({
  email,
  name
}: {
  email?: string | null;
  name?: string | null;
}) {
  useEffect(() => {
    if (!window.$crisp) return;

    if (email) window.$crisp.push(['set', 'user:email', [email]]);
    if (name) window.$crisp.push(['set', 'user:nickname', [name]]);
  }, [email, name]);

  return null;
}
