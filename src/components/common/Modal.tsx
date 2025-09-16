'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.scss';

export default function Modal({ title, children }: { title?: string; children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  // Focus + scroll lock
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

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.backdrop} onClick={() => router.back()} />
      <div ref={panelRef} tabIndex={-1} className={styles.panel} aria-label={title ?? 'Dialog'}>
        <button className={styles.closeBtn} onClick={() => router.back()} aria-label="Close">
          ×
        </button>
        {title && <h2 className={styles.title}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
