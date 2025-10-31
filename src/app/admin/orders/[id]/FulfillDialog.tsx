// src/app/admin/orders/[id]/FulfillDialog.tsx
'use client';

import { useState } from 'react';

export default function FulfillDialog({
  orderId,
  contactEmail,
  disabled
}: {
  orderId: string;
  contactEmail?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [sendEmail, setSendEmail] = useState(Boolean(contactEmail));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/fulfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNo, sendEmail })
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) throw new Error(json.error ?? 'Failed to fulfill order');

      // force reload so the page shows new status/activity
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{
          border: '1px solid #222',
          borderRadius: 8,
          padding: '6px 10px',
          background: 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
      >
        ✅ Mark as Fulfilled
      </button>

      {!open ? null : (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 1000
          }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              color: '#111',
              padding: 16,
              borderRadius: 10,
              minWidth: 360
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Mark as Fulfilled</h3>

            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Carrier (optional)</div>
              <input
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="Royal Mail, DPD, DHL…"
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 8 }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Tracking number (optional)</div>
              <input
                value={trackingNo}
                onChange={(e) => setTrackingNo(e.target.value)}
                placeholder="e.g. JD000225678GB"
                style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 8 }}
              />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 12px' }}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={!contactEmail}
              />
              <span>
                Send shipping email {contactEmail ? `to ${contactEmail}` : '(no email on order)'}
              </span>
            </label>

            {error && <div style={{ color: '#b00020', marginBottom: 8 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #222',
                  background: 'transparent'
                }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={busy}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #222',
                  background: '#111',
                  color: '#fff'
                }}
              >
                {busy ? 'Saving…' : 'Fulfill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
