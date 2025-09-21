// src/components/common/Modal.tsx
'use client';

import { closeAuthModal } from '@/lib/close-auth-modal';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.scss';

interface ModalProps {
  title?: string;
  children: React.ReactNode;
  /** Where to go when closing; if omitted we just drop modal/callbackUrl. */
  closeTo?: string;
}

export default function Modal(props: ModalProps) {
  return (
    <Suspense fallback={null}>
      <ModalInner {...props} />
    </Suspense>
  );
}

function ModalInner({ title, children, closeTo }: ModalProps) {
  const router = useRouter();
  const sp = useSearchParams()!;
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  const hardClose = useCallback(() => {
    if (closeTo) {
      router.replace(closeTo, { scroll: false });
    } else {
      closeAuthModal(router, pathname, sp);
    }
  }, [closeTo, router, pathname, sp]);

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
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hardClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, hardClose]);

  // Focus panel
  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.backdrop} onClick={hardClose} />
      <div ref={panelRef} tabIndex={-1} className={styles.panel} aria-label={title ?? 'Dialog'}>
        <button className={styles.closeBtn} onClick={hardClose} aria-label="Close">
          ×
        </button>
        {title && <h2 className={styles.title}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
