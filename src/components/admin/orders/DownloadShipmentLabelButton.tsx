// src/components/admin/orders/DownloadShipmentLabelButton.tsx
'use client';

import { useAdminUi } from '@/components/admin/ui/AdminUiProvider';

import { useState } from 'react';

export default function DownloadShipmentLabelButton({
  shipmentId,
  label = 'Download label'
}: {
  shipmentId: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const { toast } = useAdminUi();

  async function download() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/shipments/${shipmentId}/label`, { cache: 'no-store' });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast.error(j?.error ?? 'Failed to download label');
        return;
      }

      // trigger browser download
      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `label_${shipmentId}.pdf`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      style={{
        height: 36,
        borderRadius: 10,
        padding: '0 12px',
        border: '1px solid rgba(15,23,42,0.14)',
        background: '#fff',
        fontWeight: 900,
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.7 : 1
      }}
    >
      {busy ? 'Downloading…' : label}
    </button>
  );
}
