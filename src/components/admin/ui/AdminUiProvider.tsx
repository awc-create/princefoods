'use client';

/**
 * Shared admin UI provider: toasts + confirm dialogs.
 *
 * Usage:
 *   const { toast, confirm } = useAdminUi();
 *   toast.success('Saved');
 *   const ok = await confirm({ title: 'Delete product?', danger: true });
 */

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './ui.module.scss';

/* ---------------- types ---------------- */

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If set, user must type this exact string to enable the confirm button. */
  typeToConfirm?: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

export interface PromptOptions {
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** If true, empty input keeps the confirm button disabled. */
  required?: boolean;
}

interface AdminUiContextValue {
  toast: ToastApi;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Confirm dialog with a text input. Resolves to the string (may be '') or null if cancelled. */
  prompt: (opts: PromptOptions) => Promise<string | null>;
}

const AdminUiContext = createContext<AdminUiContextValue | null>(null);

export function useAdminUi(): AdminUiContextValue {
  const ctx = useContext(AdminUiContext);
  if (!ctx) throw new Error('useAdminUi must be used inside <AdminUiProvider>');
  return ctx;
}

/**
 * Like useAdminUi but safe outside the provider: falls back to native
 * alert/confirm. For shared components that are mostly-but-not-always
 * rendered inside the admin shell.
 */
export function useAdminUiSafe(): AdminUiContextValue {
  const ctx = useContext(AdminUiContext);
  return (
    ctx ?? {
      toast: {
        success: () => {},
        error: (m: string) => window.alert(m),
        info: (m: string) => window.alert(m)
      },
      confirm: (opts: ConfirmOptions) =>
        Promise.resolve(window.confirm([opts.title, opts.message].filter(Boolean).join('\n\n'))),
      prompt: (opts: PromptOptions) =>
        Promise.resolve(window.prompt(opts.title, opts.initialValue ?? '') ?? null)
    }
  );
}

/* ---------------- provider ---------------- */

type PendingConfirm =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOptions; resolve: (v: string | null) => void };

export default function AdminUiProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [typed, setTyped] = useState('');
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((ts) => [...ts.slice(-4), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 4000);
    },
    [dismiss]
  );

  const toast: ToastApi = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m)
    }),
    [push]
  );

  const confirm = useCallback((opts: ConfirmOptions) => {
    setTyped('');
    return new Promise<boolean>((resolve) => {
      setPending({ kind: 'confirm', opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    setTyped(opts.initialValue ?? '');
    return new Promise<string | null>((resolve) => {
      setPending({ kind: 'prompt', opts, resolve });
    });
  }, []);

  const settle = useCallback(
    (accepted: boolean) => {
      if (!pending) return;
      if (pending.kind === 'confirm') pending.resolve(accepted);
      else pending.resolve(accepted ? typed : null);
      setPending(null);
      setTyped('');
    },
    [pending, typed]
  );

  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt]);

  const typeToConfirm = pending?.kind === 'confirm' ? pending.opts.typeToConfirm : undefined;
  const showInput = Boolean(typeToConfirm) || pending?.kind === 'prompt';
  const typingOk =
    pending?.kind === 'prompt'
      ? !pending.opts.required || typed.trim().length > 0
      : !typeToConfirm || typed.trim() === typeToConfirm;

  return (
    <AdminUiContext.Provider value={value}>
      {children}

      {typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Toasts */}
            {toasts.length > 0 && (
              <div className={styles.toastViewport} role="status" aria-live="polite">
                {toasts.map((t) => (
                  <div
                    key={t.id}
                    className={`${styles.toast} ${
                      t.kind === 'success'
                        ? styles.toastSuccess
                        : t.kind === 'error'
                          ? styles.toastError
                          : styles.toastInfo
                    }`}
                  >
                    <span>{t.message}</span>
                    <button
                      type="button"
                      className={styles.toastClose}
                      onClick={() => dismiss(t.id)}
                      aria-label="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Confirm dialog */}
            {pending && (
              <div
                className={styles.backdrop}
                role="presentation"
                onMouseDown={(e) => {
                  if (e.target === e.currentTarget) settle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') settle(false);
                }}
              >
                <div
                  className={styles.dialog}
                  role="alertdialog"
                  aria-modal="true"
                  aria-label={pending.opts.title}
                >
                  <h2 className={styles.dialogTitle}>{pending.opts.title}</h2>
                  {pending.opts.message && (
                    <p className={styles.dialogMessage}>{pending.opts.message}</p>
                  )}

                  {showInput && (
                    <input
                      className={styles.dialogInput}
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={
                        typeToConfirm
                          ? `Type "${typeToConfirm}" to confirm`
                          : (pending.kind === 'prompt' ? pending.opts.placeholder : undefined)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && typingOk) settle(true);
                      }}
                      autoFocus
                    />
                  )}

                  <div className={styles.dialogActions}>
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      onClick={() => settle(false)}
                      autoFocus={!showInput}
                    >
                      {pending.opts.cancelLabel ?? 'Cancel'}
                    </button>
                    <button
                      type="button"
                      className={pending.opts.danger ? styles.btnDanger : styles.btnPrimary}
                      disabled={!typingOk}
                      onClick={() => settle(true)}
                    >
                      {pending.opts.confirmLabel ?? 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>,
          document.body
        )}
    </AdminUiContext.Provider>
  );
}
