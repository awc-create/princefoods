'use client';

import { useEffect, useRef, useState } from 'react';
import CancelDialog from './CancelDialog';
import FulfillDialog from './FulfillDialog';
import ShipDialog from './ShipDialog';

type BusyState = null | 'archive' | 'unarchive';

type ApiEnvelope<T> = T & { ok?: boolean; error?: string };
function isApiEnvelope<T>(v: unknown): v is ApiEnvelope<T> {
  if (!v || typeof v !== 'object') return false;
  const obj = v as Record<string, unknown>;
  return (
    ('ok' in obj ? typeof obj.ok === 'boolean' : true) &&
    ('error' in obj ? typeof obj.error === 'string' : true)
  );
}

/** Robust fetch: tolerates empty or non-JSON bodies */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });

  const text = await res.text();
  let dataUnknown: unknown = {};
  if (text && text.trim().length > 0) {
    try {
      dataUnknown = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(text || res.statusText);
      return {} as T;
    }
  }

  if (!isApiEnvelope<T>(dataUnknown)) {
    if (!res.ok) throw new Error(res.statusText);
    return dataUnknown as T;
  }
  const data = dataUnknown as ApiEnvelope<T>;
  if (!res.ok || data.ok === false) throw new Error(data.error ?? res.statusText);
  return data as T;
}

/** Augment Window to avoid `any` */
declare global {
  interface Window {
    __order_isTest?: boolean;
    __order_hasStripeCapture?: boolean;
    __order_refundableRemainingPence?: number;
  }
}

export default function MoreActions({
  orderId,
  contactEmail,
  canFulfill
}: {
  orderId: string;
  contactEmail?: string | null;
  canFulfill: boolean;
}) {
  const [openPrint, setOpenPrint] = useState(false);
  const [openActions, setOpenActions] = useState(false);
  const [busy, setBusy] = useState<BusyState>(null);
  const [openCancel, setOpenCancel] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);

  // injected by the server page
  const w: Window | undefined = typeof window !== 'undefined' ? window : undefined;
  const isTestOrder = Boolean(w?.__order_isTest);
  const hasStripeCapture = Boolean(w?.__order_hasStripeCapture);
  const refundableRemainingPence = Number(w?.__order_refundableRemainingPence ?? 0);

  // Close on click outside / Escape
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOpenPrint(false);
        setOpenActions(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenPrint(false);
        setOpenActions(false);
        setOpenCancel(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const btn: React.CSSProperties = {
    border: '1px solid #222',
    borderRadius: 8,
    padding: '6px 10px',
    background: '#fff',
    cursor: 'pointer',
    font: 'inherit'
  };
  const menu: React.CSSProperties = {
    position: 'absolute',
    top: '110%',
    right: 0,
    background: '#fff',
    color: '#111',
    border: '1px solid #222',
    borderRadius: 10,
    minWidth: 260,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    zIndex: 10
  };
  const item: React.CSSProperties = {
    display: 'block',
    padding: 8,
    textDecoration: 'none',
    color: '#111',
    cursor: 'pointer',
    font: 'inherit',
    background: 'transparent',
    border: 'none',
    width: '100%',
    textAlign: 'left'
  };
  const groupTitle: React.CSSProperties = {
    padding: '8px 8px 4px',
    fontSize: 12,
    color: '#666',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.02em'
  };
  const divider = <hr style={{ borderColor: '#eee', margin: '6px 0' }} />;

  function openCancelRefund() {
    setOpenActions(false);
    setOpenPrint(false);
    setOpenCancel(true);
  }

  async function onArchive() {
    setBusy('archive');
    try {
      await postJson<Record<string, never>>(`/api/admin/orders/${orderId}/archive`, {});
      location.reload();
    } catch (e) {
      alert(`Archive failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(null);
      setOpenActions(false);
    }
  }

  async function onUnarchive() {
    setBusy('unarchive');
    try {
      await postJson<Record<string, never>>(`/api/admin/orders/${orderId}/unarchive`, {});
      location.reload();
    } catch (e) {
      alert(`Unarchive failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(null);
      setOpenActions(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ display: 'flex', gap: 8, position: 'relative' }}>
      {/* PRINT MENU */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            setOpenPrint((v) => !v);
            setOpenActions(false);
          }}
          aria-haspopup="menu"
          aria-expanded={openPrint}
          style={btn}
          title="Print invoices / slips"
        >
          🖨️ Print
        </button>

        {openPrint && (
          <div style={menu} role="menu" aria-label="Print menu">
            <div style={{ padding: 8 }}>
              <div style={groupTitle}>Print</div>
              <a
                href={`/api/admin/orders/${orderId}/print-order`}
                target="_blank"
                rel="noopener noreferrer"
                style={item}
                role="menuitem"
                title="Warehouse picker sheet"
              >
                📦 Order (picker)
              </a>
              <a
                href={`/api/admin/orders/${orderId}/invoice`}
                target="_blank"
                rel="noopener noreferrer"
                style={item}
                role="menuitem"
                title="Invoice / receipt"
              >
                🧾 Invoice / receipt
              </a>
              <a
                href={`/api/admin/orders/${orderId}/packing-slip?v=plain`}
                target="_blank"
                rel="noopener noreferrer"
                style={item}
                role="menuitem"
              >
                🧾 Packing slip
              </a>
              <a
                href={`/api/admin/orders/${orderId}/packing-slip?v=weights`}
                target="_blank"
                rel="noopener noreferrer"
                style={item}
                role="menuitem"
              >
                🧾 Packing slip (weights)
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ACTIONS MENU */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => {
            setOpenActions((v) => !v);
            setOpenPrint(false);
          }}
          aria-haspopup="menu"
          aria-expanded={openActions}
          style={btn}
          title="Fulfil, cancel, ship, archive…"
        >
          ⚙️ Actions
        </button>

        {openActions && (
          <div style={{ ...menu, right: 0 }} role="menu" aria-label="Actions menu">
            <div style={{ padding: 8 }}>
              <div style={groupTitle}>Fulfilment</div>
              <div style={{ padding: 6 }}>
                <FulfillDialog
                  orderId={orderId}
                  contactEmail={contactEmail}
                  disabled={!canFulfill || busy !== null}
                />
              </div>

              {divider}

              <div style={groupTitle}>Shipping</div>
              <div style={{ padding: 6 }}>
                <ShipDialog
                  orderId={orderId}
                  contactEmail={contactEmail ?? null} // ← add this
                />
              </div>

              {divider}

              <div style={groupTitle}>Order</div>
              <button
                onClick={openCancelRefund}
                disabled={busy !== null}
                style={{ ...item, color: '#b00020' }}
                role="menuitem"
                title="Cancel order or refund via Stripe if applicable"
              >
                ❌ Cancel & refund
              </button>
              <button
                onClick={onArchive}
                disabled={busy !== null}
                style={item}
                role="menuitem"
                title="Archive this order"
              >
                {busy === 'archive' ? 'Archiving…' : '🗄️ Archive'}
              </button>
              <button
                onClick={onUnarchive}
                disabled={busy !== null}
                style={item}
                role="menuitem"
                title="Unarchive this order"
              >
                {busy === 'unarchive' ? 'Unarchiving…' : '🗂️ Unarchive'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CANCEL LIGHTBOX */}
      <CancelDialog
        orderId={orderId}
        open={openCancel}
        onClose={() => setOpenCancel(false)}
        isTestOrder={isTestOrder}
        hasStripeCapture={hasStripeCapture}
        refundableRemainingPence={refundableRemainingPence}
      />
    </div>
  );
}
