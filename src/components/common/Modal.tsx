// src/components/common/Modal.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

export default function Modal({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && router.back();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  // Focus + scroll lock + background disable
  useEffect(() => {
    if (!mounted) return;
    panelRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  if (!mounted) return null;

  // INLINE styles so it cannot fail due to CSS not loading
  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647, // max overlay
    display: 'grid',
    placeItems: 'center',
  };
  const backdropStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,.5)',
  };
  const panelStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: 'min(92vw, 480px)',
    maxHeight: '90vh',
    overflow: 'auto',
    borderRadius: 16,
    background: '#fff',
    padding: 24,
    boxShadow: '0 20px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08)',
  };
  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 10,
    right: 10,
    border: '1px solid #ddd',
    background: '#fff',
    borderRadius: 8,
    padding: '4px 8px',
    cursor: 'pointer',
  };

  return createPortal(
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div style={backdropStyle} onClick={() => router.back()} />
      <div ref={panelRef} tabIndex={-1} style={panelStyle} aria-label={title || 'Dialog'}>
        <button style={closeBtnStyle} onClick={() => router.back()} aria-label="Close">
          ×
        </button>
        {title && <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 600 }}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
