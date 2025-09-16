'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
}

export default function Lightbox({ title, children, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // lock scroll
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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  // focus
  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  if (!mounted) return null;

  const overlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647,
    display: 'grid',
    placeItems: 'center'
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
      <div style={backdrop} onClick={onClose} />
      <div ref={panelRef} tabIndex={-1} style={panel} aria-label={title ?? 'Dialog'}>
        <button style={closeBtn} onClick={onClose} aria-label="Close">
          ×
        </button>
        {title && <h2 style={h2}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
