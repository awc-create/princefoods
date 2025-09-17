'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title?: string;
  children: React.ReactNode;
  /** Where to go when closing; falls back to ?from or '/'. */
  closeTo?: string;
}

/** Public export wrapped in Suspense so useSearchParams is safe everywhere. */
export default function Modal(props: ModalProps) {
  return (
    <Suspense fallback={null}>
      <ModalInner {...props} />
    </Suspense>
  );
}

function ModalInner({ title, children, closeTo }: ModalProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Decide close target once on mount so it doesn't flicker
  const target = closeTo ?? sp?.get('from') ?? '/';
  const close = useCallback(() => router.replace(target), [router, target]);

  useEffect(() => setMounted(true), []);

  // Body scroll lock
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // ESC to close
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, close]);

  // Focus panel for accessibility
  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  if (!mounted) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647,
    display: 'grid',
    placeItems: 'center',
    pointerEvents: 'auto'
  };
  const backdrop: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,.55)'
  };
  const panel: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: 'min(92vw, 480px)',
    maxHeight: '90vh',
    overflow: 'auto',
    borderRadius: 16,
    background: '#fff',
    padding: 24,
    boxShadow: '0 24px 60px rgba(0,0,0,.22), 0 2px 10px rgba(0,0,0,.08)',
    outline: 'none'
  };
  const closeBtn: React.CSSProperties = {
    position: 'absolute',
    top: 10,
    right: 10,
    border: '1px solid #e5e7eb',
    background: '#fff',
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    lineHeight: 1.2
  };
  const h2: React.CSSProperties = { margin: '0 0 12px', fontSize: 20, fontWeight: 600 };

  return createPortal(
    <div style={overlay} role="dialog" aria-modal="true">
      <div style={backdrop} onClick={close} />
      <div ref={panelRef} tabIndex={-1} style={panel} aria-label={title ?? 'Dialog'}>
        <button style={closeBtn} onClick={close} aria-label="Close">
          ×
        </button>
        {title && <h2 style={h2}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
