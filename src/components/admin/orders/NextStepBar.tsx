// src/components/admin/orders/NextStepBar.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';
import type { NextStep, NextStepAction } from '@/lib/order-next-step';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TONE: Record<
  NextStep['tone'],
  { bg: string; border: string; fg: string; icon: string; chip: string }
> = {
  action: { bg: '#eff6ff', border: '#bfdbfe', fg: '#1e3a8a', icon: '👉', chip: '#1d4ed8' },
  waiting: { bg: '#fffbeb', border: '#fde68a', fg: '#78350f', icon: '⏳', chip: '#b45309' },
  done: { bg: '#f0fdf4', border: '#bbf7d0', fg: '#14532d', icon: '✅', chip: '#15803d' },
  problem: { bg: '#fef2f2', border: '#fecaca', fg: '#7f1d1d', icon: '⚠️', chip: '#b91c1c' }
};

export default function NextStepBar({
  step,
  orderId,
  shipmentId
}: {
  step: NextStep;
  orderId: string;
  shipmentId?: string | null;
}) {
  const t = TONE[step.tone];
  const router = useRouter();
  const { toast, confirm } = useAdminUi();
  const [busy, setBusy] = useState(false);

  async function runAction(a: NextStepAction) {
    if (!a.action) return;

    if (a.action === 'buy-label') {
      // The real control lives just below — take the user to it and make it obvious.
      const el = document.getElementById('buy-apc-label');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('nsb-flash');
        window.setTimeout(() => el.classList.remove('nsb-flash'), 2200);
      }
      return;
    }

    if (a.action === 'notify-customer') {
      if (!shipmentId) {
        toast.error('No shipment found for this order yet.');
        return;
      }
      const ok = await confirm({
        title: 'Email tracking to the customer?',
        message:
          'They will get an email saying the order is on its way, including the tracking link.',
        confirmLabel: 'Send email'
      });
      if (!ok) return;

      setBusy(true);
      try {
        const res = await fetch(`/api/admin/shipments/${shipmentId}/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ includeLabelLink: true })
        });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !j?.ok) throw new Error(j?.error ?? `Failed (${res.status})`);
        toast.success('Customer emailed — this order is now on its way.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not send the email.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (a.action === 'undo-cancel') {
      const ok = await confirm({
        title: 'Undo this cancellation?',
        message: 'The order goes back to its previous state and can be packed again.',
        confirmLabel: 'Undo cancellation'
      });
      if (!ok) return;

      setBusy(true);
      try {
        const res = await fetch(`/api/admin/orders/${orderId}/revert-cancel`, { method: 'POST' });
        const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || j?.ok === false) throw new Error(j?.error ?? 'Failed to undo.');
        toast.success('Cancellation undone.');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not undo the cancellation.');
      } finally {
        setBusy(false);
      }
    }
  }

  function renderBtn(a: NextStepAction, primary: boolean) {
    const style: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '9px 16px',
      borderRadius: 10,
      fontWeight: 700,
      fontSize: 14,
      cursor: busy ? 'not-allowed' : 'pointer',
      opacity: busy ? 0.6 : 1,
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      border: primary ? `1px solid ${t.chip}` : '1px solid rgba(0,0,0,0.15)',
      background: primary ? t.chip : '#fff',
      color: primary ? '#fff' : '#111827'
    };

    if (a.href) {
      return (
        <a
          key={a.label}
          href={a.href}
          target={a.newTab ? '_blank' : undefined}
          rel={a.newTab ? 'noopener noreferrer' : undefined}
          style={style}
        >
          {a.label}
        </a>
      );
    }

    return (
      <button
        key={a.label}
        type="button"
        disabled={busy}
        onClick={() => void runAction(a)}
        style={style}
      >
        {busy ? 'Working…' : a.label}
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes nsbFlash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(29,78,216,0); }
          20%, 60% { box-shadow: 0 0 0 4px rgba(29,78,216,0.45); }
        }
        .nsb-flash { animation: nsbFlash 1.1s ease-in-out 2; border-radius: 10px; }
      `}</style>

      <section
        aria-label="What to do next"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          padding: '14px 16px',
          borderRadius: 12,
          border: `1px solid ${t.border}`,
          background: t.bg,
          color: t.fg
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>
          {t.icon}
        </span>

        <div style={{ flex: '1 1 320px', minWidth: 260 }}>
          <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>{step.title}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.45, opacity: 0.92 }}>{step.detail}</div>
        </div>

        {(step.primary ?? step.secondary) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {step.primary && renderBtn(step.primary, true)}
            {step.secondary && renderBtn(step.secondary, false)}
          </div>
        )}
      </section>
    </>
  );
}
