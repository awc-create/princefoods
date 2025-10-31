'use client';

export default function UndoCancelButton({
  orderId,
  untilISO,
  disabled
}: {
  orderId: string;
  untilISO: string; // pass from server as ISO string
  disabled?: boolean;
}) {
  async function handleClick() {
    const res = await fetch(`/api/admin/orders/${orderId}/revert-cancel`, { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j?.ok === false) {
      alert(j?.error ?? 'Failed to revert cancellation');
      return;
    }
    alert('Cancellation reverted.');
    location.reload();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={{
        border: '1px solid #b68900',
        background: '#ffd24d',
        color: '#4a3900',
        borderRadius: 8,
        padding: '6px 10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        font: 'inherit',
        opacity: disabled ? 0.6 : 1
      }}
      title={`Restore this order (no refund was processed). Window until ${new Date(
        untilISO
      ).toLocaleString('en-GB')}`}
    >
      Undo cancellation
    </button>
  );
}
