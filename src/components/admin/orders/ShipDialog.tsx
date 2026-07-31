'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useState } from 'react';

export default function ShipDialog({ orderId }: { orderId: string }) {
  const [carrier, setCarrier] = useState('APC Overnight');
  const { toast } = useAdminUi();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [emailCustomer, setEmailCustomer] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber, emailCustomer })
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j?.error ?? 'Failed');
      toast.success('Tracking added successfully');
      location.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        placeholder="Tracking number"
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        style={{ padding: 6, border: '1px solid #ccc', borderRadius: 6 }}
      />
      <label>
        Carrier:&nbsp;
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)}>
          <option>APC Overnight</option>
          <option>Royal Mail</option>
          <option>DPD</option>
          <option>Evri</option>
          <option>Other</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={emailCustomer}
          onChange={(e) => setEmailCustomer(e.target.checked)}
        />{' '}
        Email customer tracking info
      </label>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !trackingNumber}
        style={{
          background: '#174e2e',
          color: 'white',
          padding: '6px 10px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer'
        }}
      >
        {loading ? 'Saving...' : 'Add tracking'}
      </button>
    </div>
  );
}
