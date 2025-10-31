'use client';

import { useEffect, useMemo, useState } from 'react';

type Mode = 'CANCEL_ONLY' | 'FULL_REFUND' | 'PARTIAL_REFUND' | 'MARK_REFUNDED_EXTERNALLY';

/** Safe JSON fetch helpers (handle empty / non-JSON) */
async function safeJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(res.statusText);
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (!res.ok) throw new Error(text || res.statusText);
    return {} as T;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return safeJson<T>(res);
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });
  return safeJson<T>(res);
}

export default function CancelDialog({
  orderId,
  open,
  onClose,
  isTestOrder,
  hasStripeCapture,
  refundableRemainingPence
}: {
  orderId: string;
  open: boolean;
  onClose: () => void;
  isTestOrder: boolean;
  hasStripeCapture: boolean;
  refundableRemainingPence: number;
}) {
  const [mode, setMode] = useState<Mode>('CANCEL_ONLY');
  const [reason, setReason] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewUntil, setPreviewUntil] = useState<string>('');

  /**
   * Fetches the cancel window (either from PolicyDoc or API)
   * This now prefers `cancelReversibleUntil`, with a fallback to `editableUntil`.
   */
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await getJson<{
          cancelReversalMinutes?: number;
          cancelReversibleUntil?: string;
          editableUntil?: string;
        }>('/api/admin/settings/orders');

        // fallback chain: cancelReversibleUntil → editableUntil → computed from minutes
        if (data.cancelReversibleUntil) {
          setPreviewUntil(new Date(data.cancelReversibleUntil).toLocaleString('en-GB'));
        } else if (data.editableUntil) {
          setPreviewUntil(new Date(data.editableUntil).toLocaleString('en-GB'));
        } else {
          const mins = data.cancelReversalMinutes ?? 1440;
          const d = new Date(Date.now() + mins * 60_000);
          setPreviewUntil(d.toLocaleString('en-GB'));
        }
      } catch {
        setPreviewUntil('');
      }
    })();
  }, [open]);

  // Determine default mode based on Stripe / refundability
  useEffect(() => {
    if (hasStripeCapture && refundableRemainingPence > 0 && !isTestOrder) {
      setMode('FULL_REFUND');
    } else {
      setMode('CANCEL_ONLY');
    }
  }, [hasStripeCapture, refundableRemainingPence, isTestOrder, open]);

  const maxRefundPounds = useMemo(
    () => (refundableRemainingPence > 0 ? (refundableRemainingPence / 100).toFixed(2) : '0.00'),
    [refundableRemainingPence]
  );

  async function submit() {
    setSaving(true);
    try {
      let amountPence: number | undefined = undefined;
      if (mode === 'PARTIAL_REFUND') {
        const trimmed = amountStr.trim();
        if (!trimmed) throw new Error('Enter a partial refund amount.');
        const pounds = Number(trimmed);
        if (!Number.isFinite(pounds) || pounds <= 0) throw new Error('Invalid amount.');
        amountPence = Math.round(pounds * 100);
        if (amountPence > refundableRemainingPence) {
          throw new Error('Amount exceeds remaining refundable balance.');
        }
      }

      const resp = await postJson<{
        ok?: boolean;
        mode?: 'stripe-refund' | 'cancel-only' | 'manual-refund';
        refundedPence?: number;
        editableUntil?: string;
        cancelReversibleUntil?: string;
        error?: string;
      }>(`/api/admin/orders/${orderId}/cancel`, {
        reason: reason || undefined,
        mode,
        amountPence
      });

      if (resp.error) throw new Error(resp.error);

      const until =
        resp.cancelReversibleUntil ??
        resp.editableUntil ??
        new Date(Date.now() + 1440 * 60_000).toISOString();

      if (resp.mode === 'stripe-refund') {
        const pounds = ((resp.refundedPence ?? 0) / 100).toFixed(2);
        alert(
          `Refunded £${pounds} via Stripe. Undo available until ${new Date(until).toLocaleString('en-GB')}.`
        );
      } else if (resp.mode === 'manual-refund') {
        alert(
          `Marked as refunded externally. Undo available until ${new Date(until).toLocaleString('en-GB')}.`
        );
      } else {
        alert(`Order cancelled. Undo available until ${new Date(until).toLocaleString('en-GB')}.`);
      }

      location.reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to cancel/refund.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cancel & refund"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 560,
          maxWidth: '96vw',
          background: '#fff',
          color: '#111',
          border: '1px solid #222',
          borderRadius: 12,
          boxShadow: '0 24px 48px rgba(0,0,0,.18)',
          padding: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Cancel order & optional refund</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 14, color: '#444' }}>
          When cancelled, the order can be reverted until{' '}
          <strong>{previewUntil || 'the configured reversal window'}</strong>, unless a refund has
          already been processed.
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Optional note shown in activity log"
            style={{
              width: '100%',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: 10,
              font: 'inherit'
            }}
          />
        </div>

        {/* Refund handling */}
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Refund handling
          </label>

          <div
            style={{
              display: 'grid',
              gap: 8,
              border: '1px solid #eee',
              padding: 10,
              borderRadius: 10
            }}
          >
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="mode"
                value="CANCEL_ONLY"
                checked={mode === 'CANCEL_ONLY'}
                onChange={() => setMode('CANCEL_ONLY')}
              />
              <span>Cancel only (no card refund)</span>
            </label>

            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                opacity: hasStripeCapture && !isTestOrder && refundableRemainingPence > 0 ? 1 : 0.5
              }}
            >
              <input
                type="radio"
                name="mode"
                value="FULL_REFUND"
                disabled={!hasStripeCapture || isTestOrder || refundableRemainingPence <= 0}
                checked={mode === 'FULL_REFUND'}
                onChange={() => setMode('FULL_REFUND')}
              />
              <span>
                Full refund to card (£{maxRefundPounds})
                {isTestOrder ? ' — disabled in test orders' : ''}
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                opacity: hasStripeCapture && !isTestOrder && refundableRemainingPence > 0 ? 1 : 0.5
              }}
            >
              <input
                type="radio"
                name="mode"
                value="PARTIAL_REFUND"
                disabled={!hasStripeCapture || isTestOrder || refundableRemainingPence <= 0}
                checked={mode === 'PARTIAL_REFUND'}
                onChange={() => setMode('PARTIAL_REFUND')}
              />
              <span>Partial refund to card</span>
            </label>

            {mode === 'PARTIAL_REFUND' && (
              <div style={{ display: 'flex', gap: 8, paddingLeft: 26 }}>
                <span>£</span>
                <input
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  style={{
                    width: 120,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: '6px 8px',
                    font: 'inherit'
                  }}
                />
                <span style={{ color: '#666' }}>Max £{maxRefundPounds}</span>
              </div>
            )}

            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name="mode"
                value="MARK_REFUNDED_EXTERNALLY"
                checked={mode === 'MARK_REFUNDED_EXTERNALLY'}
                onChange={() => setMode('MARK_REFUNDED_EXTERNALLY')}
              />
              <span>Mark as refunded externally (cash/bank/gift-card), no Stripe action</span>
            </label>
          </div>

          <div style={{ marginTop: 10, fontSize: 13, color: '#666' }}>
            • Test orders and gift-card-only orders will never attempt a Stripe refund. <br />• If a
            refund is processed, the order cannot be reverted.
          </div>
        </div>

        <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid #ccc',
              background: '#fff',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            style={{
              border: '1px solid #222',
              background: '#111',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 12px',
              cursor: 'pointer'
            }}
          >
            {saving ? 'Processing…' : 'Confirm cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
