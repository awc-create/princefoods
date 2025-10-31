// src/app/admin/orders/OrderActionsCell.tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Busy = null | 'cancel' | 'archive' | 'unarchive';

type ApiEnvelope<T> = T & { ok?: boolean; error?: string };
function isApiEnvelope<T>(v: unknown): v is ApiEnvelope<T> {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    ('ok' in o ? typeof o.ok === 'boolean' : true) &&
    ('error' in o ? typeof o.error === 'string' : true)
  );
}

/** POST JSON that tolerates empty/non-JSON bodies and surfaces API envelopes */
async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  let dataUnknown: unknown = {};
  if (text.trim().length > 0) {
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
  if (!res.ok || data.ok === false) {
    throw new Error(data.error ?? res.statusText);
  }
  return data as T;
}

export default function OrderActionsCell({
  orderId,
  isArchived,
  contactEmail,
  onChanged
}: {
  orderId: string;
  isArchived: boolean;
  contactEmail?: string | null;
  /** optional callback to re-fetch table after action */
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  async function doCancel() {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    const reason = window.prompt('Optional note/reason (leave blank if none):') ?? '';
    setBusy('cancel');
    try {
      await postJson<{ ok: true }>(`/api/admin/orders/${orderId}/cancel`, {
        mode: 'CANCEL_ONLY',
        reason: reason.trim() ?? ''
      });
      setOpen(false);
      onChanged?.();
    } catch (e) {
      alert(`Cancel failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  async function doArchive() {
    if (!window.confirm('Are you sure you want to archive this order?')) return;
    setBusy('archive');
    try {
      await postJson<{ ok: true }>(`/api/admin/orders/${orderId}/archive`, {});
      setOpen(false);
      onChanged?.();
    } catch (e) {
      alert(`Archive failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

  async function doUnarchive() {
    if (!window.confirm('Are you sure you want to unarchive this order?')) return;
    setBusy('unarchive');
    try {
      await postJson<{ ok: true }>(`/api/admin/orders/${orderId}/unarchive`, {});
      setOpen(false);
      onChanged?.();
    } catch (e) {
      alert(`Unarchive failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setBusy(null);
    }
  }

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
    minWidth: 220,
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

  const divider = <hr style={{ borderColor: '#eee', margin: '6px 0' }} />;

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={btn}
        title="More actions"
      >
        ⋯
      </button>

      {open && (
        <div role="menu" aria-label="Row actions" style={menu}>
          <div style={{ padding: 8 }}>
            <Link
              href={`/admin/orders/${orderId}`}
              style={{ ...item, display: 'block' }}
              onClick={() => setOpen(false)}
            >
              View order
            </Link>

            {divider}

            <button
              type="button"
              onClick={doCancel}
              disabled={busy !== null}
              style={{ ...item, color: '#b00020' }}
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
            </button>

            {!isArchived ? (
              <button type="button" onClick={doArchive} disabled={busy !== null} style={item}>
                {busy === 'archive' ? 'Archiving…' : 'Archive'}
              </button>
            ) : (
              <button type="button" onClick={doUnarchive} disabled={busy !== null} style={item}>
                {busy === 'unarchive' ? 'Unarchiving…' : 'Unarchive'}
              </button>
            )}

            {divider}

            <div
              style={{
                padding: '6px 8px',
                fontSize: 12,
                color: '#666'
              }}
            >
              {/** Use ?? instead of || to satisfy prefer-nullish-coalescing */}
              {`Customer: ${contactEmail ?? '—'}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
