import ShipmentsClient from './shipments-client';

export const dynamic = 'force-dynamic';

export default function AdminShipmentsPage() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Shipments</h1>
        <p style={{ margin: 0, color: '#94a3b8', fontWeight: 650, fontSize: 13 }}>
          Reprint labels, email tracking, or cancel a label
        </p>
      </div>

      <div style={{ height: 14 }} />

      <ShipmentsClient />
    </div>
  );
}
