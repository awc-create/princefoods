'use client';

import { useEffect } from 'react';

export default function CrispChat() {
  useEffect(() => {
    const id = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!id) return;

    // Prevent double-inject (hot reload / route changes)
    if (document.getElementById('crisp-chat-script')) return;

    // Ensure queue exists before Crisp script loads
    window.$crisp = window.$crisp ?? [];
    window.CRISP_WEBSITE_ID = id;

    const s = document.createElement('script');
    s.id = 'crisp-chat-script';
    s.src = 'https://client.crisp.chat/l.js';
    s.async = true;
    document.head.appendChild(s);
  }, []);

  return null;
}
