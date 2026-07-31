// src/app/admin/orders/%5Bid%5D/ShipDialog.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useState } from 'react';

type Carrier = 'APC Overnight' | 'Royal Mail' | 'Evri' | 'DPD' | 'Other';

export default function ShipDialog({
  orderId,
  contactEmail
}: {
  orderId: string;
  contactEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useAdminUi();
  const [carrier, setCarrier] = useState<Carrier>('APC Overnight');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [weightGrams, setWeightGrams] = useState<string>('');
  const [emailCustomer, setEmailCustomer] = useState<boolean>(!!contactEmail);
  const [markFulfilled, setMarkFulfilled] = useState(false);
  const [busy, setBusy] = useState(false);

  const hasEmail = !!contactEmail;

  function autoUrl(nextTracking: string, nextCarrier = carrier) {
    // Light helper so APC gets a sensible default
    if (nextCarrier === 'APC Overnight' && nextTracking.trim()) {
      setTrackingUrl(
        `https://apc-overnight.com/recexpress/tracking/?consignment=${encodeURIComponent(
          nextTracking.trim()
        )}`
      );
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast.error('Enter a tracking number');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          carrier,
          trackingNumber: trackingNumber.trim(),
          trackingUrl: trackingUrl.trim() || undefined,
          weightGrams: weightGrams ? Number(weightGrams) : undefined,
          emailCustomer: emailCustomer && hasEmail, // never attempt without an email
          markFulfilled
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) {
        toast.error(j?.error ?? 'Failed to save tracking');
        return;
      }
      toast.success(j.emailed ? 'Tracking saved and emailed to customer.' : 'Tracking saved.');
      setOpen(false);
      location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Add tracking number"
        style={{
          border: '1px solid #222',
          borderRadius: 8,
          padding: '6px 10px',
          background: '#fff',
          cursor: 'pointer',
          font: 'inherit'
        }}
      >
        📦 Add tracking
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #ddd',
              width: 'min(520px, 92vw)',
              padding: 16,
              boxShadow: '0 10px 30px rgba(0,0,0,.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Add Tracking</h3>

            <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                Carrier
                <select
                  value={carrier}
                  onChange={(e) => {
                    const next = e.target.value as Carrier;
                    setCarrier(next);
                    autoUrl(trackingNumber, next);
                  }}
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
                >
                  <option value="APC Overnight">APC Overnight</option>
                  <option value="Royal Mail">Royal Mail</option>
                  <option value="Evri">Evri</option>
                  <option value="DPD">DPD</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Tracking number
                <input
                  value={trackingNumber}
                  onChange={(e) => {
                    setTrackingNumber(e.target.value);
                    autoUrl(e.target.value);
                  }}
                  placeholder="e.g. 123456789"
                  required
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Tracking URL (optional)
                <input
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="Paste link from the carrier (optional)"
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                Parcel weight (grams, optional)
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="e.g. 1200"
                  style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd' }}
                />
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={emailCustomer && hasEmail}
                  onChange={(e) => setEmailCustomer(e.target.checked)}
                  disabled={!hasEmail}
                />
                Email customer the tracking details{' '}
                {hasEmail ? (
                  <span style={{ color: '#666' }}>(to {contactEmail})</span>
                ) : (
                  <span style={{ color: '#b00' }}>(no email on order)</span>
                )}
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={markFulfilled}
                  onChange={(e) => setMarkFulfilled(e.target.checked)}
                />
                Mark order as Fulfilled
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    background: '#111',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: busy ? 'not-allowed' : 'pointer'
                  }}
                >
                  {busy ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    border: '1px solid #ddd',
                    background: '#fff',
                    borderRadius: 8,
                    padding: '8px 12px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
